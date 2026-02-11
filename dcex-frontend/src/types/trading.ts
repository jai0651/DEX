export type OrderSide = 'buy' | 'sell'
export type OrderStatus = 'pending' | 'partiallyfilled' | 'filled' | 'cancelled'

export interface Market {
  id: string
  base_mint: string
  quote_mint: string
  base_decimals: number
  quote_decimals: number
  min_order_size: number
  tick_size: number
  maker_fee_bps: number
  taker_fee_bps: number
  is_active: boolean
  created_at: string
}

export interface Order {
  id: number
  order_id: string
  user_wallet: string
  market_id: string
  side: OrderSide
  price: number
  size: number
  filled: number
  status: OrderStatus
  on_chain_signature: string | null
  created_at: string
  updated_at: string
}

export interface Trade {
  id: number
  market_id: string
  maker_order_id: string
  taker_order_id: string
  maker_wallet: string
  taker_wallet: string
  price: number
  size: number
  maker_fee: number
  taker_fee: number
  settlement_signature: string | null
  created_at: string
}

export interface OrderbookLevel {
  price: number
  size: number
  order_count: number
}

export interface OrderbookSnapshot {
  market_id: string
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  last_price: number | null
  timestamp: string
}

export interface UserVault {
  base_balance: number
  quote_balance: number
  base_locked: number
  quote_locked: number
}

export interface PlaceOrderRequest {
  market_id: string
  side: OrderSide
  price: number
  size: number
  wallet: string
  signature: string
  order_id?: string
}

export interface WsMessage {
  type: 'subscribe' | 'unsubscribe' | 'orderbook_snapshot' | 'orderbook_update' | 'trade' | 'order_update' | 'error'
  data?: unknown
}
