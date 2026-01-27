import { create } from 'zustand'
import type { Market, Order, OrderbookSnapshot, Trade } from '@/types/trading'

interface TradingState {
  selectedMarket: Market | null
  orderbook: OrderbookSnapshot | null
  trades: Trade[]
  openOrders: Order[]
  isConnected: boolean

  setSelectedMarket: (market: Market | null) => void
  setOrderbook: (orderbook: OrderbookSnapshot | null) => void
  updateOrderbook: (bids: OrderbookSnapshot['bids'], asks: OrderbookSnapshot['asks']) => void
  addTrade: (trade: Trade) => void
  setTrades: (trades: Trade[]) => void
  setOpenOrders: (orders: Order[]) => void
  updateOrder: (order: Order) => void
  setConnected: (connected: boolean) => void
}

export const useTradingStore = create<TradingState>((set, get) => ({
  selectedMarket: null,
  orderbook: null,
  trades: [],
  openOrders: [],
  isConnected: false,

  setSelectedMarket: (market) => set({ selectedMarket: market }),

  setOrderbook: (orderbook) => set({ orderbook }),

  updateOrderbook: (bids, asks) => {
    const current = get().orderbook
    if (current) {
      set({
        orderbook: {
          ...current,
          bids,
          asks,
          timestamp: new Date().toISOString(),
        },
      })
    }
  },

  addTrade: (trade) => {
    set((state) => ({
      trades: [trade, ...state.trades.slice(0, 99)],
    }))
  },

  setTrades: (trades) => set({ trades }),

  setOpenOrders: (orders) => set({ openOrders: orders }),

  updateOrder: (order) => {
    set((state) => ({
      openOrders: state.openOrders.map((o) =>
        o.order_id === order.order_id ? order : o
      ),
    }))
  },

  setConnected: (connected) => set({ isConnected: connected }),
}))
