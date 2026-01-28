'use client'

import { FC, useMemo } from 'react'
import { useTradingStore } from '@/lib/stores/trading'
import { formatPrice, formatSize, cn } from '@/lib/utils'
import { ArrowDown, ArrowUp } from 'lucide-react'

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
      <div className="bg-card rounded-2xl border border-white/5 h-full min-h-[500px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-pink border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground text-sm">Loading orderbook...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-2xl border border-white/5 h-full min-h-[500px] flex flex-col">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-semibold">Order Book</h3>
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-lg bg-muted text-foreground">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect y="0" width="14" height="3" rx="1" fill="currentColor" opacity="0.3"/>
              <rect y="5.5" width="14" height="3" rx="1" fill="currentColor"/>
              <rect y="11" width="14" height="3" rx="1" fill="currentColor" opacity="0.3"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 text-xs text-muted-foreground px-4 py-2 border-b border-white/5">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col-reverse">
          {orderbook.asks.slice(0, 12).reverse().map((level, idx) => (
            <div
              key={`ask-${level.price}-${idx}`}
              className="relative grid grid-cols-3 text-sm px-4 py-1.5 hover:bg-white/5 cursor-pointer transition-colors group"
              onClick={() => onPriceClick?.(level.price)}
            >
              <div
                className="absolute inset-0 bg-sell/10 transition-all"
                style={{ 
                  width: `${(level.size / maxAskSize) * 100}%`, 
                  right: 0, 
                  left: 'auto',
                  borderRadius: '4px'
                }}
              />
              <div className="relative text-sell font-medium group-hover:text-sell/80">
                {formatPrice(level.price)}
              </div>
              <div className="relative text-right font-mono text-muted-foreground">
                {formatSize(level.size)}
              </div>
              <div className="relative text-right font-mono text-muted-foreground/70">
                {formatSize(level.size * level.price / 1e9)}
              </div>
            </div>
          ))}
        </div>

        {spread && (
          <div className="py-3 px-4 bg-muted/50 border-y border-white/5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">
                  {formatPrice(orderbook.last_price || orderbook.bids[0]?.price || 0)}
                </span>
                <span className="text-buy">
                  <ArrowUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-secondary">
                  Spread: {spread.percentage.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {orderbook.bids.slice(0, 12).map((level, idx) => (
            <div
              key={`bid-${level.price}-${idx}`}
              className="relative grid grid-cols-3 text-sm px-4 py-1.5 hover:bg-white/5 cursor-pointer transition-colors group"
              onClick={() => onPriceClick?.(level.price)}
            >
              <div
                className="absolute inset-0 bg-buy/10 transition-all"
                style={{ 
                  width: `${(level.size / maxBidSize) * 100}%`,
                  borderRadius: '4px'
                }}
              />
              <div className="relative text-buy font-medium group-hover:text-buy/80">
                {formatPrice(level.price)}
              </div>
              <div className="relative text-right font-mono text-muted-foreground">
                {formatSize(level.size)}
              </div>
              <div className="relative text-right font-mono text-muted-foreground/70">
                {formatSize(level.size * level.price / 1e9)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
