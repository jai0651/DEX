use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use crate::types::{OrderbookSnapshot, Trade, Order, WsMessage};

type ClientId = u64;
type ClientSender = mpsc::UnboundedSender<WsMessage>;

pub struct WebSocketManager {
    clients: RwLock<HashMap<ClientId, ClientSender>>,
    subscriptions: RwLock<HashMap<Uuid, HashSet<ClientId>>>,
    next_client_id: std::sync::atomic::AtomicU64,
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self {
            clients: RwLock::new(HashMap::new()),
            subscriptions: RwLock::new(HashMap::new()),
            next_client_id: std::sync::atomic::AtomicU64::new(1),
        }
    }

    pub async fn add_client(&self) -> (ClientId, mpsc::UnboundedReceiver<WsMessage>) {
        let client_id = self.next_client_id.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let (tx, rx) = mpsc::unbounded_channel();
        
        self.clients.write().await.insert(client_id, tx);
        
        (client_id, rx)
    }

    pub async fn remove_client(&self, client_id: ClientId) {
        self.clients.write().await.remove(&client_id);
        
        let mut subscriptions = self.subscriptions.write().await;
        for subscribers in subscriptions.values_mut() {
            subscribers.remove(&client_id);
        }
    }

    pub async fn subscribe(&self, client_id: ClientId, market_id: Uuid) {
        self.subscriptions
            .write()
            .await
            .entry(market_id)
            .or_insert_with(HashSet::new)
            .insert(client_id);
    }

    pub async fn unsubscribe(&self, client_id: ClientId, market_id: Uuid) {
        if let Some(subscribers) = self.subscriptions.write().await.get_mut(&market_id) {
            subscribers.remove(&client_id);
        }
    }

    pub async fn send_to_client(&self, client_id: ClientId, message: WsMessage) {
        if let Some(sender) = self.clients.read().await.get(&client_id) {
            let _ = sender.send(message);
        }
    }

    pub async fn broadcast_to_market(&self, market_id: &Uuid, message: WsMessage) {
        let subscriptions = self.subscriptions.read().await;
        let clients = self.clients.read().await;
        
        if let Some(subscribers) = subscriptions.get(market_id) {
            for client_id in subscribers {
                if let Some(sender) = clients.get(client_id) {
                    let _ = sender.send(message.clone());
                }
            }
        }
    }

    pub async fn broadcast_orderbook_snapshot(&self, snapshot: OrderbookSnapshot) {
        let market_id = snapshot.market_id;
        let message = WsMessage::OrderbookSnapshot(snapshot);
        self.broadcast_to_market(&market_id, message).await;
    }

    pub async fn broadcast_trade(&self, trade: Trade) {
        let market_id = trade.market_id;
        let message = WsMessage::Trade(trade);
        self.broadcast_to_market(&market_id, message).await;
    }

    pub async fn broadcast_order_update(&self, order: Order) {
        let market_id = order.market_id;
        let message = WsMessage::OrderUpdate(order);
        self.broadcast_to_market(&market_id, message).await;
    }
}
