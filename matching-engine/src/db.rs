use sqlx::PgPool;
use uuid::Uuid;

use crate::error::Result;
use crate::types::{Market, Order, OrderSide, OrderStatus, Trade};

pub async fn get_market(pool: &PgPool, market_id: Uuid) -> Result<Option<Market>> {
    let market = sqlx::query_as!(
        Market,
        r#"
        SELECT 
            id, base_mint, quote_mint, base_decimals, quote_decimals,
            min_order_size, tick_size, maker_fee_bps, taker_fee_bps,
            is_active, created_at
        FROM markets
        WHERE id = $1
        "#,
        market_id
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(market)
}

pub async fn get_active_markets(pool: &PgPool) -> Result<Vec<Market>> {
    let markets = sqlx::query_as!(
        Market,
        r#"
        SELECT 
            id, base_mint, quote_mint, base_decimals, quote_decimals,
            min_order_size, tick_size, maker_fee_bps, taker_fee_bps,
            is_active, created_at
        FROM markets
        WHERE is_active = true
        ORDER BY created_at DESC
        "#
    )
    .fetch_all(pool)
    .await?;
    
    Ok(markets)
}

pub async fn create_order(
    pool: &PgPool,
    order_id: i64,
    user_wallet: &str,
    market_id: Uuid,
    side: OrderSide,
    price: i64,
    size: i64,
) -> Result<Order> {
    let side_str = match side {
        OrderSide::Buy => "buy",
        OrderSide::Sell => "sell",
    };
    
    let order = sqlx::query_as!(
        Order,
        r#"
        INSERT INTO orders (order_id, user_wallet, market_id, side, price, size, filled, status)
        VALUES ($1, $2, $3, $4, $5, $6, 0, 'pending')
        RETURNING 
            id, order_id, user_wallet, market_id,
            side as "side: OrderSide", price, size, filled,
            status as "status: OrderStatus",
            on_chain_signature, created_at, updated_at
        "#,
        order_id,
        user_wallet,
        market_id,
        side_str,
        price,
        size
    )
    .fetch_one(pool)
    .await?;
    
    Ok(order)
}

pub async fn get_order(pool: &PgPool, order_id: i64) -> Result<Option<Order>> {
    let order = sqlx::query_as!(
        Order,
        r#"
        SELECT 
            id, order_id, user_wallet, market_id,
            side as "side: OrderSide", price, size, filled,
            status as "status: OrderStatus",
            on_chain_signature, created_at, updated_at
        FROM orders
        WHERE order_id = $1
        "#,
        order_id
    )
    .fetch_optional(pool)
    .await?;
    
    Ok(order)
}

pub async fn update_order_status(
    pool: &PgPool,
    order_id: i64,
    status: OrderStatus,
    filled: i64,
) -> Result<Order> {
    let status_str = match status {
        OrderStatus::Pending => "pending",
        OrderStatus::PartiallyFilled => "partiallyfilled",
        OrderStatus::Filled => "filled",
        OrderStatus::Cancelled => "cancelled",
    };
    
    let order = sqlx::query_as!(
        Order,
        r#"
        UPDATE orders
        SET status = $2, filled = $3, updated_at = NOW()
        WHERE order_id = $1
        RETURNING 
            id, order_id, user_wallet, market_id,
            side as "side: OrderSide", price, size, filled,
            status as "status: OrderStatus",
            on_chain_signature, created_at, updated_at
        "#,
        order_id,
        status_str,
        filled
    )
    .fetch_one(pool)
    .await?;
    
    Ok(order)
}

pub async fn get_user_orders(
    pool: &PgPool,
    user_wallet: &str,
    market_id: Option<Uuid>,
) -> Result<Vec<Order>> {
    let orders = if let Some(mid) = market_id {
        sqlx::query_as!(
            Order,
            r#"
            SELECT 
                id, order_id, user_wallet, market_id,
                side as "side: OrderSide", price, size, filled,
                status as "status: OrderStatus",
                on_chain_signature, created_at, updated_at
            FROM orders
            WHERE user_wallet = $1 AND market_id = $2
            ORDER BY created_at DESC
            LIMIT 100
            "#,
            user_wallet,
            mid
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            Order,
            r#"
            SELECT 
                id, order_id, user_wallet, market_id,
                side as "side: OrderSide", price, size, filled,
                status as "status: OrderStatus",
                on_chain_signature, created_at, updated_at
            FROM orders
            WHERE user_wallet = $1
            ORDER BY created_at DESC
            LIMIT 100
            "#,
            user_wallet
        )
        .fetch_all(pool)
        .await?
    };
    
    Ok(orders)
}

pub async fn create_trade(
    pool: &PgPool,
    market_id: Uuid,
    maker_order_id: i64,
    taker_order_id: i64,
    maker_wallet: &str,
    taker_wallet: &str,
    price: i64,
    size: i64,
    maker_fee: i64,
    taker_fee: i64,
) -> Result<Trade> {
    let trade = sqlx::query_as!(
        Trade,
        r#"
        INSERT INTO trades (
            market_id, maker_order_id, taker_order_id,
            maker_wallet, taker_wallet, price, size,
            maker_fee, taker_fee
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING 
            id, market_id, maker_order_id, taker_order_id,
            maker_wallet, taker_wallet, price, size,
            maker_fee, taker_fee, settlement_signature, created_at
        "#,
        market_id,
        maker_order_id,
        taker_order_id,
        maker_wallet,
        taker_wallet,
        price,
        size,
        maker_fee,
        taker_fee
    )
    .fetch_one(pool)
    .await?;
    
    Ok(trade)
}

pub async fn get_recent_trades(
    pool: &PgPool,
    market_id: Uuid,
    limit: i64,
) -> Result<Vec<Trade>> {
    let trades = sqlx::query_as!(
        Trade,
        r#"
        SELECT 
            id, market_id, maker_order_id, taker_order_id,
            maker_wallet, taker_wallet, price, size,
            maker_fee, taker_fee, settlement_signature, created_at
        FROM trades
        WHERE market_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        "#,
        market_id,
        limit
    )
    .fetch_all(pool)
    .await?;
    
    Ok(trades)
}
