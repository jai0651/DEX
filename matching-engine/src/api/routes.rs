use std::sync::Arc;
use axum::{
    routing::{get, post, delete},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::AppState;
use super::handlers;
use super::ws_handler;

pub fn create_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(handlers::health_check))
        .route("/api/markets", get(handlers::get_markets))
        .route("/api/markets/:market_id", get(handlers::get_market))
        .route("/api/markets/:market_id/orderbook", get(handlers::get_orderbook))
        .route("/api/markets/:market_id/trades", get(handlers::get_trades))
        .route("/api/orders", post(handlers::place_order))
        .route("/api/orders/:order_id", delete(handlers::cancel_order))
        .route("/api/orders/:order_id", get(handlers::get_order))
        .route("/api/users/:wallet/orders", get(handlers::get_user_orders))
        .route("/api/deposits", post(handlers::record_deposit))
        .route("/api/withdrawals", post(handlers::record_withdrawal))
        .route("/api/users/:wallet/deposits", get(handlers::get_user_deposits))
        .route("/api/users/:wallet/withdrawals", get(handlers::get_user_withdrawals))
        .route("/ws", get(ws_handler::websocket_handler))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
