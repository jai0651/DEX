use std::collections::{BTreeMap, HashMap};
use std::cmp::Reverse;
use uuid::Uuid;
use chrono::Utc;

use crate::types::{Order, OrderSide, OrderbookLevel, OrderbookSnapshot};

#[derive(Debug, Clone)]
pub struct OrderEntry {
    pub order_id: String,
    pub user_wallet: String,
    pub size: i64,
    pub filled: i64,
    pub timestamp: i64,
}

impl OrderEntry {
    pub fn remaining(&self) -> i64 {
        self.size - self.filled
    }
}

pub struct Orderbook {
    pub market_id: Uuid,
    pub bids: BTreeMap<Reverse<i64>, Vec<OrderEntry>>,
    pub asks: BTreeMap<i64, Vec<OrderEntry>>,
    pub order_locations: HashMap<String, (OrderSide, i64)>,
    pub last_price: Option<i64>,
}

impl Orderbook {
    pub fn new(market_id: Uuid) -> Self {
        Self {
            market_id,
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            order_locations: HashMap::new(),
            last_price: None,
        }
    }

    pub fn add_order(&mut self, order: &Order) {
        let entry = OrderEntry {
            order_id: order.order_id.clone(),
            user_wallet: order.user_wallet.clone(),
            size: order.size,
            filled: order.filled,
            timestamp: order.created_at.timestamp_nanos_opt().unwrap_or(0),
        };

        match order.side {
            OrderSide::Buy => {
                self.bids
                    .entry(Reverse(order.price))
                    .or_insert_with(Vec::new)
                    .push(entry);
                self.order_locations.insert(order.order_id.clone(), (OrderSide::Buy, order.price));
            }
            OrderSide::Sell => {
                self.asks
                    .entry(order.price)
                    .or_insert_with(Vec::new)
                    .push(entry);
                self.order_locations.insert(order.order_id.clone(), (OrderSide::Sell, order.price));
            }
        }
    }

    pub fn remove_order(&mut self, order_id: &str) -> Option<OrderEntry> {
        if let Some((side, price)) = self.order_locations.remove(order_id) {
            match side {
                OrderSide::Buy => {
                    if let Some(orders) = self.bids.get_mut(&Reverse(price)) {
                        if let Some(idx) = orders.iter().position(|o| o.order_id == order_id) {
                            let entry = orders.remove(idx);
                            if orders.is_empty() {
                                self.bids.remove(&Reverse(price));
                            }
                            return Some(entry);
                        }
                    }
                }
                OrderSide::Sell => {
                    if let Some(orders) = self.asks.get_mut(&price) {
                        if let Some(idx) = orders.iter().position(|o| o.order_id == order_id) {
                            let entry = orders.remove(idx);
                            if orders.is_empty() {
                                self.asks.remove(&price);
                            }
                            return Some(entry);
                        }
                    }
                }
            }
        }
        None
    }

    pub fn update_order_fill(&mut self, order_id: &str, filled_amount: i64) {
        if let Some((side, price)) = self.order_locations.get(order_id) {
            match side {
                OrderSide::Buy => {
                    if let Some(orders) = self.bids.get_mut(&Reverse(*price)) {
                        if let Some(order) = orders.iter_mut().find(|o| o.order_id == order_id) {
                            order.filled += filled_amount;
                            if order.remaining() <= 0 {
                                self.remove_order(order_id);
                            }
                        }
                    }
                }
                OrderSide::Sell => {
                    if let Some(orders) = self.asks.get_mut(price) {
                        if let Some(order) = orders.iter_mut().find(|o| o.order_id == order_id) {
                            order.filled += filled_amount;
                            if order.remaining() <= 0 {
                                self.remove_order(order_id);
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn best_bid(&self) -> Option<i64> {
        self.bids.first_key_value().map(|(Reverse(price), _)| *price)
    }

    pub fn best_ask(&self) -> Option<i64> {
        self.asks.first_key_value().map(|(price, _)| *price)
    }

    pub fn spread(&self) -> Option<i64> {
        match (self.best_ask(), self.best_bid()) {
            (Some(ask), Some(bid)) => Some(ask - bid),
            _ => None,
        }
    }

    pub fn get_bids(&self, depth: usize) -> Vec<OrderbookLevel> {
        self.bids
            .iter()
            .take(depth)
            .map(|(Reverse(price), orders)| OrderbookLevel {
                price: *price,
                size: orders.iter().map(|o| o.remaining()).sum(),
                order_count: orders.len(),
            })
            .collect()
    }

    pub fn get_asks(&self, depth: usize) -> Vec<OrderbookLevel> {
        self.asks
            .iter()
            .take(depth)
            .map(|(price, orders)| OrderbookLevel {
                price: *price,
                size: orders.iter().map(|o| o.remaining()).sum(),
                order_count: orders.len(),
            })
            .collect()
    }

    pub fn snapshot(&self, depth: usize) -> OrderbookSnapshot {
        OrderbookSnapshot {
            market_id: self.market_id,
            bids: self.get_bids(depth),
            asks: self.get_asks(depth),
            last_price: self.last_price,
            timestamp: Utc::now(),
        }
    }

    pub fn set_last_price(&mut self, price: i64) {
        self.last_price = Some(price);
    }
}

pub struct OrderbookManager {
    orderbooks: HashMap<Uuid, Orderbook>,
}

impl OrderbookManager {
    pub fn new() -> Self {
        Self {
            orderbooks: HashMap::new(),
        }
    }

    pub fn get_or_create(&mut self, market_id: Uuid) -> &mut Orderbook {
        self.orderbooks
            .entry(market_id)
            .or_insert_with(|| Orderbook::new(market_id))
    }

    pub fn get(&self, market_id: &Uuid) -> Option<&Orderbook> {
        self.orderbooks.get(market_id)
    }

    pub fn get_mut(&mut self, market_id: &Uuid) -> Option<&mut Orderbook> {
        self.orderbooks.get_mut(market_id)
    }
}
