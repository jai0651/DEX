use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum OrderStatus {
    Pending,
    PartiallyFilled,
    Filled,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: i64,
    pub order_id: i64,
    pub user_wallet: String,
    pub market_id: Uuid,
    pub side: OrderSide,
    pub price: i64,
    pub size: i64,
    pub filled: i64,
    pub status: OrderStatus,
    pub on_chain_signature: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Order {
    pub fn remaining(&self) -> i64 {
        self.size - self.filled
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: i64,
    pub market_id: Uuid,
    pub maker_order_id: i64,
    pub taker_order_id: i64,
    pub maker_wallet: String,
    pub taker_wallet: String,
    pub price: i64,
    pub size: i64,
    pub maker_fee: i64,
    pub taker_fee: i64,
    pub settlement_signature: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub id: Uuid,
    pub base_mint: String,
    pub quote_mint: String,
    pub base_decimals: i16,
    pub quote_decimals: i16,
    pub min_order_size: i64,
    pub tick_size: i64,
    pub maker_fee_bps: i16,
    pub taker_fee_bps: i16,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderbookLevel {
    pub price: i64,
    pub size: i64,
    pub order_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderbookSnapshot {
    pub market_id: Uuid,
    pub bids: Vec<OrderbookLevel>,
    pub asks: Vec<OrderbookLevel>,
    pub last_price: Option<i64>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaceOrderRequest {
    pub market_id: Uuid,
    pub side: OrderSide,
    pub price: i64,
    pub size: i64,
    pub wallet: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CancelOrderRequest {
    pub order_id: i64,
    pub wallet: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    #[serde(rename = "subscribe")]
    Subscribe { market_id: Uuid },
    #[serde(rename = "unsubscribe")]
    Unsubscribe { market_id: Uuid },
    #[serde(rename = "orderbook_snapshot")]
    OrderbookSnapshot(OrderbookSnapshot),
    #[serde(rename = "orderbook_update")]
    OrderbookUpdate { market_id: Uuid, bids: Vec<OrderbookLevel>, asks: Vec<OrderbookLevel> },
    #[serde(rename = "trade")]
    Trade(Trade),
    #[serde(rename = "order_update")]
    OrderUpdate(Order),
    #[serde(rename = "error")]
    Error { message: String },
}
