use std::sync::Arc;
use tokio::sync::RwLock;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod orderbook;
mod settlement;
mod websocket;
mod config;
mod db;
mod error;
mod types;

use crate::orderbook::OrderbookManager;
use crate::settlement::SettlementQueue;
use crate::websocket::WebSocketManager;

pub struct AppState {
    pub orderbook_manager: Arc<RwLock<OrderbookManager>>,
    pub settlement_queue: Arc<SettlementQueue>,
    pub ws_manager: Arc<WebSocketManager>,
    pub db_pool: sqlx::PgPool,
    pub redis: redis::aio::ConnectionManager,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "matching_engine=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env()?;
    
    tracing::info!("Connecting to database...");
    let db_pool = sqlx::PgPool::connect(&config.database_url).await?;
    
    tracing::info!("Running migrations...");
    sqlx::migrate!("./migrations").run(&db_pool).await?;
    
    tracing::info!("Connecting to Redis...");
    let redis_client = redis::Client::open(config.redis_url.clone())?;
    let redis = redis::aio::ConnectionManager::new(redis_client).await?;
    
    let orderbook_manager = Arc::new(RwLock::new(OrderbookManager::new()));
    let ws_manager = Arc::new(WebSocketManager::new());
    let settlement_queue = Arc::new(SettlementQueue::new(
        db_pool.clone(),
        config.solana_rpc_url.clone(),
    ));

    let state = Arc::new(AppState {
        orderbook_manager: orderbook_manager.clone(),
        settlement_queue: settlement_queue.clone(),
        ws_manager: ws_manager.clone(),
        db_pool,
        redis,
    });

    let settlement_state = state.clone();
    tokio::spawn(async move {
        settlement_state.settlement_queue.run().await;
    });

    let app = api::create_router(state);

    let listener = tokio::net::TcpListener::bind(&config.server_addr).await?;
    tracing::info!("Matching engine listening on {}", config.server_addr);
    
    axum::serve(listener, app).await?;

    Ok(())
}
