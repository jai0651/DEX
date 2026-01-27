'use client'

import { FC, useMemo } from 'react'
import { useTradingStore } from '@/lib/stores/trading'
import { formatPrice, formatSize, cn } from '@/lib/utils'

interface OrderbookProps {
  onPriceClick?: (price: number) => void
}

export const Orderbook: FC<OrderbookProps> = ({ onPriceClick }) => {
  const orderbook = useTradingStore((state) => state.orderbook)

  const { maxBidSize, maxAskSize } = useMemo(() => {
    if (!orderbook) return { maxBidSize: 0, maxAskSize: 0 }
    const maxBid = Math.max(...orderbook.bids.map((b) => b.size), 1)
    const maxAsk = Math.max(...orderbook.asks.map((a) => a.size), 1)
    return { maxBidSize: maxBid, maxAskSize: maxAsk }
  }, [orderbook])

  const spread = useMemo(() => {
    if (!orderbook || orderbook.bids.length === 0 || orderbook.asks.length === 0) {
      return null
    }
    const bestBid = orderbook.bids[0].price
    const bestAsk = orderbook.asks[0].price
    return {
      absolute: bestAsk - bestBid,
      percentage: ((bestAsk - bestBid) / bestAsk) * 100,
    }
  }, [orderbook])

  if (!orderbook) {
    return (
      <div className="bg-card rounded-lg p-4 h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading orderbook...</div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <h3 className="font-semibold">Order Book</h3>
      </div>

      <div className="grid grid-cols-3 text-xs text-muted-foreground px-3 py-2 border-b border-border">
        <div>Price (USDC)</div>
        <div className="text-right">Size (SOL)</div>
        <div className="text-right">Total</div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col-reverse">
          {orderbook.asks.slice(0, 15).reverse().map((level, idx) => (
            <div
              key={`ask-${level.price}-${idx}`}
              className="relative grid grid-cols-3 text-sm px-3 py-1 hover:bg-secondary/50 cursor-pointer"
              onClick={() => onPriceClick?.(level.price)}
            >
              <div
                className="absolute inset-0 bg-sell/10"
                style={{ width: `${(level.size / maxAskSize) * 100}%`, right: 0, left: 'auto' }}
              />
              <div className="relative text-sell">{formatPrice(level.price)}</div>
              <div className="relative text-right">{formatSize(level.size)}</div>
              <div className="relative text-right text-muted-foreground">
                {formatSize(level.size * level.price / 1e9)}
              </div>
            </div>
          ))}
        </div>

        {spread && (
          <div className="py-2 px-3 bg-secondary/50 border-y border-border">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">
                {formatPrice(orderbook.last_price || orderbook.bids[0]?.price || 0)}
              </span>
              <span className="text-xs text-muted-foreground">
                Spread: {formatPrice(spread.absolute)} ({spread.percentage.toFixed(2)}%)
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {orderbook.bids.slice(0, 15).map((level, idx) => (
            <div
              key={`bid-${level.price}-${idx}`}
              className="relative grid grid-cols-3 text-sm px-3 py-1 hover:bg-secondary/50 cursor-pointer"
              onClick={() => onPriceClick?.(level.price)}
            >
              <div
                className="absolute inset-0 bg-buy/10"
                style={{ width: `${(level.size / maxBidSize) * 100}%` }}
              />
              <div className="relative text-buy">{formatPrice(level.price)}</div>
              <div className="relative text-right">{formatSize(level.size)}</div>
              <div className="relative text-right text-muted-foreground">
                {formatSize(level.size * level.price / 1e9)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
