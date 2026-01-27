import type { OrderbookSnapshot, Trade, Order } from '@/types/trading'
import { useTradingStore } from '@/lib/stores/trading'

type MessageHandler = {
  onOrderbookSnapshot?: (snapshot: OrderbookSnapshot) => void
  onOrderbookUpdate?: (data: { market_id: string; bids: OrderbookSnapshot['bids']; asks: OrderbookSnapshot['asks'] }) => void
  onTrade?: (trade: Trade) => void
  onOrderUpdate?: (order: Order) => void
  onError?: (message: string) => void
}

class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private handlers: MessageHandler = {}
  private subscribedMarkets: Set<string> = new Set()

  constructor() {
    this.url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws'
  }

  connect(handlers: MessageHandler = {}) {
    this.handlers = handlers

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        useTradingStore.getState().setConnected(true)
        this.reconnectAttempts = 0

        this.subscribedMarkets.forEach((marketId) => {
          this.subscribe(marketId)
        })
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected')
        useTradingStore.getState().setConnected(false)
        this.attemptReconnect()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }

  private handleMessage(message: { type: string; data?: unknown }) {
    switch (message.type) {
      case 'orderbook_snapshot':
        if (this.handlers.onOrderbookSnapshot) {
          this.handlers.onOrderbookSnapshot(message.data as OrderbookSnapshot)
        }
        useTradingStore.getState().setOrderbook(message.data as OrderbookSnapshot)
        break

      case 'orderbook_update':
        if (this.handlers.onOrderbookUpdate) {
          this.handlers.onOrderbookUpdate(
            message.data as { market_id: string; bids: OrderbookSnapshot['bids']; asks: OrderbookSnapshot['asks'] }
          )
        }
        const updateData = message.data as { bids: OrderbookSnapshot['bids']; asks: OrderbookSnapshot['asks'] }
        useTradingStore.getState().updateOrderbook(updateData.bids, updateData.asks)
        break

      case 'trade':
        if (this.handlers.onTrade) {
          this.handlers.onTrade(message.data as Trade)
        }
        useTradingStore.getState().addTrade(message.data as Trade)
        break

      case 'order_update':
        if (this.handlers.onOrderUpdate) {
          this.handlers.onOrderUpdate(message.data as Order)
        }
        useTradingStore.getState().updateOrder(message.data as Order)
        break

      case 'error':
        if (this.handlers.onError) {
          this.handlers.onError((message.data as { message: string }).message)
        }
        break
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
      console.log(`Attempting reconnect in ${delay}ms...`)
      setTimeout(() => this.connect(this.handlers), delay)
    }
  }

  subscribe(marketId: string) {
    this.subscribedMarkets.add(marketId)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', data: { market_id: marketId } }))
    }
  }

  unsubscribe(marketId: string) {
    this.subscribedMarkets.delete(marketId)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', data: { market_id: marketId } }))
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.subscribedMarkets.clear()
  }
}

export const wsClient = new WebSocketClient()
