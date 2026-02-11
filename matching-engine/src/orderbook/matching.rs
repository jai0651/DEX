use std::cmp::Reverse;
use uuid::Uuid;
use chrono::Utc;

use super::orderbook::{Orderbook, OrderEntry};
use crate::types::{Order, OrderSide, Trade};

#[derive(Debug, Clone)]
pub struct MatchResult {
    pub trades: Vec<TradeMatch>,
    pub remaining_size: i64,
}

#[derive(Debug, Clone)]
pub struct TradeMatch {
    pub maker_order_id: String,
    pub maker_wallet: String,
    pub taker_order_id: String,
    pub taker_wallet: String,
    pub price: i64,
    pub size: i64,
}

pub struct MatchingEngine;

impl MatchingEngine {
    pub fn match_order(orderbook: &mut Orderbook, incoming: &Order) -> MatchResult {
        let mut trades = Vec::new();
        let mut remaining = incoming.size - incoming.filled;

        match incoming.side {
            OrderSide::Buy => {
                Self::match_buy_order(orderbook, incoming, &mut trades, &mut remaining);
            }
            OrderSide::Sell => {
                Self::match_sell_order(orderbook, incoming, &mut trades, &mut remaining);
            }
        }

        if !trades.is_empty() {
            if let Some(last_trade) = trades.last() {
                orderbook.set_last_price(last_trade.price);
            }
        }

        MatchResult {
            trades,
            remaining_size: remaining,
        }
    }

    fn match_buy_order(
        orderbook: &mut Orderbook,
        incoming: &Order,
        trades: &mut Vec<TradeMatch>,
        remaining: &mut i64,
    ) {
        let mut prices_to_remove = Vec::new();
        
        for (price, orders) in orderbook.asks.iter_mut() {
            if *price > incoming.price {
                break;
            }

            let mut orders_to_remove = Vec::new();
            
            for (idx, maker_order) in orders.iter_mut().enumerate() {
                if *remaining <= 0 {
                    break;
                }

                let fill_size = (*remaining).min(maker_order.remaining());
                
                trades.push(TradeMatch {
                    maker_order_id: maker_order.order_id.clone(),
                    maker_wallet: maker_order.user_wallet.clone(),
                    taker_order_id: incoming.order_id.clone(),
                    taker_wallet: incoming.user_wallet.clone(),
                    price: *price,
                    size: fill_size,
                });

                maker_order.filled += fill_size;
                *remaining -= fill_size;

                if maker_order.remaining() <= 0 {
                    orders_to_remove.push(idx);
                    orderbook.order_locations.remove(&maker_order.order_id);
                }
            }

            for idx in orders_to_remove.into_iter().rev() {
                orders.remove(idx);
            }

            if orders.is_empty() {
                prices_to_remove.push(*price);
            }

            if *remaining <= 0 {
                break;
            }
        }

        for price in prices_to_remove {
            orderbook.asks.remove(&price);
        }
    }

    fn match_sell_order(
        orderbook: &mut Orderbook,
        incoming: &Order,
        trades: &mut Vec<TradeMatch>,
        remaining: &mut i64,
    ) {
        let mut prices_to_remove = Vec::new();
        
        for (Reverse(price), orders) in orderbook.bids.iter_mut() {
            if *price < incoming.price {
                break;
            }

            let mut orders_to_remove = Vec::new();
            
            for (idx, maker_order) in orders.iter_mut().enumerate() {
                if *remaining <= 0 {
                    break;
                }

                let fill_size = (*remaining).min(maker_order.remaining());
                
                trades.push(TradeMatch {
                    maker_order_id: maker_order.order_id.clone(),
                    maker_wallet: maker_order.user_wallet.clone(),
                    taker_order_id: incoming.order_id.clone(),
                    taker_wallet: incoming.user_wallet.clone(),
                    price: *price,
                    size: fill_size,
                });

                maker_order.filled += fill_size;
                *remaining -= fill_size;

                if maker_order.remaining() <= 0 {
                    orders_to_remove.push(idx);
                    orderbook.order_locations.remove(&maker_order.order_id);
                }
            }

            for idx in orders_to_remove.into_iter().rev() {
                orders.remove(idx);
            }

            if orders.is_empty() {
                prices_to_remove.push(Reverse(*price));
            }

            if *remaining <= 0 {
                break;
            }
        }

        for price in prices_to_remove {
            orderbook.bids.remove(&price);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_order(
        order_id: &str,
        wallet: &str,
        side: OrderSide,
        price: i64,
        size: i64,
    ) -> Order {
        Order {
            id: 1,
            order_id: order_id.to_string(),
            user_wallet: wallet.to_string(),
            market_id: Uuid::new_v4(),
            side,
            price,
            size,
            filled: 0,
            status: crate::types::OrderStatus::Pending,
            on_chain_signature: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_simple_match() {
        let market_id = Uuid::new_v4();
        let mut orderbook = Orderbook::new(market_id);

        let sell_order = create_test_order("1", "seller", OrderSide::Sell, 100, 10);
        orderbook.add_order(&sell_order);

        let buy_order = create_test_order("2", "buyer", OrderSide::Buy, 100, 5);
        let result = MatchingEngine::match_order(&mut orderbook, &buy_order);

        assert_eq!(result.trades.len(), 1);
        assert_eq!(result.trades[0].size, 5);
        assert_eq!(result.remaining_size, 0);
    }

    #[test]
    fn test_partial_fill() {
        let market_id = Uuid::new_v4();
        let mut orderbook = Orderbook::new(market_id);

        let sell_order = create_test_order("1", "seller", OrderSide::Sell, 100, 5);
        orderbook.add_order(&sell_order);

        let buy_order = create_test_order("2", "buyer", OrderSide::Buy, 100, 10);
        let result = MatchingEngine::match_order(&mut orderbook, &buy_order);

        assert_eq!(result.trades.len(), 1);
        assert_eq!(result.trades[0].size, 5);
        assert_eq!(result.remaining_size, 5);
    }

    #[test]
    fn test_no_match_price_gap() {
        let market_id = Uuid::new_v4();
        let mut orderbook = Orderbook::new(market_id);

        let sell_order = create_test_order("1", "seller", OrderSide::Sell, 110, 10);
        orderbook.add_order(&sell_order);

        let buy_order = create_test_order("2", "buyer", OrderSide::Buy, 100, 5);
        let result = MatchingEngine::match_order(&mut orderbook, &buy_order);

        assert_eq!(result.trades.len(), 0);
        assert_eq!(result.remaining_size, 5);
    }
}
