use std::sync::Arc;
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::types::{
    Market, Order, OrderSide, OrderStatus, OrderbookSnapshot, PlaceOrderRequest, Trade,
};
use crate::orderbook::{MatchingEngine, MatchResult};
use crate::settlement::SettlementTask;
use crate::AppState;
use crate::db;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}

pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

pub async fn get_markets(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Market>>> {
    let markets = db::get_active_markets(&state.db_pool).await?;
    Ok(Json(markets))
}

pub async fn get_market(
    State(state): State<Arc<AppState>>,
    Path(market_id): Path<Uuid>,
) -> Result<Json<Market>> {
    let market = db::get_market(&state.db_pool, market_id)
        .await?
        .ok_or(AppError::MarketNotFound)?;
    Ok(Json(market))
}

#[derive(Deserialize)]
pub struct OrderbookQuery {
    pub depth: Option<usize>,
}

pub async fn get_orderbook(
    State(state): State<Arc<AppState>>,
    Path(market_id): Path<Uuid>,
    Query(query): Query<OrderbookQuery>,
) -> Result<Json<OrderbookSnapshot>> {
    let depth = query.depth.unwrap_or(20);
    
    let orderbook_manager = state.orderbook_manager.read().await;
    let snapshot = orderbook_manager
        .get(&market_id)
        .map(|ob| ob.snapshot(depth))
        .unwrap_or_else(|| OrderbookSnapshot {
            market_id,
            bids: vec![],
            asks: vec![],
            last_price: None,
            timestamp: chrono::Utc::now(),
        });
    
    Ok(Json(snapshot))
}

#[derive(Deserialize)]
pub struct TradesQuery {
    pub limit: Option<i64>,
}

pub async fn get_trades(
    State(state): State<Arc<AppState>>,
    Path(market_id): Path<Uuid>,
    Query(query): Query<TradesQuery>,
) -> Result<Json<Vec<Trade>>> {
    let limit = query.limit.unwrap_or(50);
    let trades = db::get_recent_trades(&state.db_pool, market_id, limit).await?;
    Ok(Json(trades))
}

#[derive(Serialize)]
pub struct PlaceOrderResponse {
    pub order: Order,
    pub trades: Vec<TradeInfo>,
}

#[derive(Serialize)]
pub struct TradeInfo {
    pub maker_order_id: i64,
    pub price: i64,
    pub size: i64,
}

pub async fn place_order(
    State(state): State<Arc<AppState>>,
    Json(req): Json<PlaceOrderRequest>,
) -> Result<Json<PlaceOrderResponse>> {
    let market = db::get_market(&state.db_pool, req.market_id)
        .await?
        .ok_or(AppError::MarketNotFound)?;

    if !market.is_active {
        return Err(AppError::InvalidOrder("Market is not active".to_string()));
    }

    if req.size < market.min_order_size {
        return Err(AppError::InvalidOrder(format!(
            "Order size {} is below minimum {}",
            req.size, market.min_order_size
        )));
    }

    if req.price % market.tick_size != 0 {
        return Err(AppError::InvalidOrder(format!(
            "Price {} is not aligned to tick size {}",
            req.price, market.tick_size
        )));
    }

    let order_id = chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0);
    
    let order = db::create_order(
        &state.db_pool,
        order_id,
        &req.wallet,
        req.market_id,
        req.side,
        req.price,
        req.size,
    ).await?;

    let mut orderbook_manager = state.orderbook_manager.write().await;
    let orderbook = orderbook_manager.get_or_create(req.market_id);
    
    let match_result = MatchingEngine::match_order(orderbook, &order);
    
    let mut trade_infos = Vec::new();
    for trade_match in &match_result.trades {
        db::update_order_status(
            &state.db_pool,
            trade_match.maker_order_id,
            OrderStatus::PartiallyFilled,
            trade_match.size,
        ).await?;

        let task = SettlementTask {
            trade_match: trade_match.clone(),
            market_id: req.market_id,
            maker_fee_bps: market.maker_fee_bps,
            taker_fee_bps: market.taker_fee_bps,
        };
        state.settlement_queue.queue_settlement(task).await
            .map_err(|e| AppError::Internal(e))?;

        trade_infos.push(TradeInfo {
            maker_order_id: trade_match.maker_order_id,
            price: trade_match.price,
            size: trade_match.size,
        });
    }

    let total_filled: i64 = match_result.trades.iter().map(|t| t.size).sum();
    let updated_order = if total_filled > 0 {
        let status = if total_filled >= order.size {
            OrderStatus::Filled
        } else {
            OrderStatus::PartiallyFilled
        };
        db::update_order_status(&state.db_pool, order_id, status, total_filled).await?
    } else {
        orderbook.add_order(&order);
        order
    };

    let snapshot = orderbook.snapshot(20);
    drop(orderbook_manager);
    
    state.ws_manager.broadcast_orderbook_snapshot(snapshot).await;
    state.ws_manager.broadcast_order_update(updated_order.clone()).await;

    Ok(Json(PlaceOrderResponse {
        order: updated_order,
        trades: trade_infos,
    }))
}

pub async fn cancel_order(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<i64>,
) -> Result<Json<Order>> {
    let order = db::get_order(&state.db_pool, order_id)
        .await?
        .ok_or(AppError::OrderNotFound)?;

    if !matches!(order.status, OrderStatus::Pending | OrderStatus::PartiallyFilled) {
        return Err(AppError::InvalidOrder("Order cannot be cancelled".to_string()));
    }

    let updated_order = db::update_order_status(
        &state.db_pool,
        order_id,
        OrderStatus::Cancelled,
        order.filled,
    ).await?;

    let mut orderbook_manager = state.orderbook_manager.write().await;
    if let Some(orderbook) = orderbook_manager.get_mut(&order.market_id) {
        orderbook.remove_order(order_id);
        
        let snapshot = orderbook.snapshot(20);
        drop(orderbook_manager);
        
        state.ws_manager.broadcast_orderbook_snapshot(snapshot).await;
    }

    state.ws_manager.broadcast_order_update(updated_order.clone()).await;

    Ok(Json(updated_order))
}

pub async fn get_order(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<i64>,
) -> Result<Json<Order>> {
    let order = db::get_order(&state.db_pool, order_id)
        .await?
        .ok_or(AppError::OrderNotFound)?;
    Ok(Json(order))
}

#[derive(Deserialize)]
pub struct UserOrdersQuery {
    pub market_id: Option<Uuid>,
}

pub async fn get_user_orders(
    State(state): State<Arc<AppState>>,
    Path(wallet): Path<String>,
    Query(query): Query<UserOrdersQuery>,
) -> Result<Json<Vec<Order>>> {
    let orders = db::get_user_orders(&state.db_pool, &wallet, query.market_id).await?;
    Ok(Json(orders))
}
