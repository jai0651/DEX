import type { Market, Order, OrderbookSnapshot, Trade, PlaceOrderRequest } from '@/types/trading'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `API error: ${res.status}`)
  }

  return res.json()
}

export const api = {
  getMarkets: () => fetchApi<Market[]>('/api/markets'),

  getMarket: (marketId: string) => fetchApi<Market>(`/api/markets/${marketId}`),

  getOrderbook: (marketId: string, depth = 20) =>
    fetchApi<OrderbookSnapshot>(`/api/markets/${marketId}/orderbook?depth=${depth}`),

  getTrades: (marketId: string, limit = 50) =>
    fetchApi<Trade[]>(`/api/markets/${marketId}/trades?limit=${limit}`),

  placeOrder: (order: PlaceOrderRequest) =>
    fetchApi<{ order: Order; trades: Array<{ maker_order_id: number; price: number; size: number }> }>(
      '/api/orders',
      {
        method: 'POST',
        body: JSON.stringify(order),
      }
    ),

  cancelOrder: (orderId: number) =>
    fetchApi<Order>(`/api/orders/${orderId}`, { method: 'DELETE' }),

  getOrder: (orderId: number) => fetchApi<Order>(`/api/orders/${orderId}`),

  getUserOrders: (wallet: string, marketId?: string) => {
    const params = marketId ? `?market_id=${marketId}` : ''
    return fetchApi<Order[]>(`/api/users/${wallet}/orders${params}`)
  },
}
