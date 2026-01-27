use std::sync::Arc;
use tokio::sync::mpsc;
use sqlx::PgPool;

use crate::orderbook::TradeMatch;

pub struct SettlementQueue {
    db_pool: PgPool,
    solana_rpc_url: String,
    tx: mpsc::Sender<SettlementTask>,
    rx: tokio::sync::Mutex<mpsc::Receiver<SettlementTask>>,
}

#[derive(Debug)]
pub struct SettlementTask {
    pub trade_match: TradeMatch,
    pub market_id: uuid::Uuid,
    pub maker_fee_bps: i16,
    pub taker_fee_bps: i16,
}

impl SettlementQueue {
    pub fn new(db_pool: PgPool, solana_rpc_url: String) -> Self {
        let (tx, rx) = mpsc::channel(10000);
        Self {
            db_pool,
            solana_rpc_url,
            tx,
            rx: tokio::sync::Mutex::new(rx),
        }
    }

    pub async fn queue_settlement(&self, task: SettlementTask) -> anyhow::Result<()> {
        self.tx.send(task).await?;
        Ok(())
    }

    pub async fn run(&self) {
        let mut rx = self.rx.lock().await;
        
        while let Some(task) = rx.recv().await {
            if let Err(e) = self.process_settlement(task).await {
                tracing::error!("Settlement failed: {:?}", e);
            }
        }
    }

    async fn process_settlement(&self, task: SettlementTask) -> anyhow::Result<()> {
        let quote_amount = task.trade_match.size * task.trade_match.price / 1_000_000_000;
        let maker_fee = quote_amount * task.maker_fee_bps as i64 / 10000;
        let taker_fee = quote_amount * task.taker_fee_bps as i64 / 10000;

        let trade = crate::db::create_trade(
            &self.db_pool,
            task.market_id,
            task.trade_match.maker_order_id,
            task.trade_match.taker_order_id,
            &task.trade_match.maker_wallet,
            &task.trade_match.taker_wallet,
            task.trade_match.price,
            task.trade_match.size,
            maker_fee,
            taker_fee,
        ).await?;

        tracing::info!(
            "Trade recorded: maker={}, taker={}, price={}, size={}",
            trade.maker_order_id,
            trade.taker_order_id,
            trade.price,
            trade.size
        );

        Ok(())
    }
}
