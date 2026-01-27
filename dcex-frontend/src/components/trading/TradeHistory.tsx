'use client'

import { FC } from 'react'
import { useTradingStore } from '@/lib/stores/trading'
import { formatPrice, formatSize, formatTimestamp, cn } from '@/lib/utils'

export const TradeHistory: FC = () => {
  const trades = useTradingStore((state) => state.trades)

  return (
    <div className="bg-card rounded-lg h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <h3 className="font-semibold">Recent Trades</h3>
      </div>

      <div className="grid grid-cols-3 text-xs text-muted-foreground px-3 py-2 border-b border-border">
        <div>Price (USDC)</div>
        <div className="text-right">Size (SOL)</div>
        <div className="text-right">Time</div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No recent trades
          </div>
        ) : (
          trades.map((trade) => {
            const isBuy = trade.taker_wallet !== trade.maker_wallet
            return (
              <div
                key={trade.id}
                className="grid grid-cols-3 text-sm px-3 py-1.5 hover:bg-secondary/50"
              >
                <div className={cn(isBuy ? 'text-buy' : 'text-sell')}>
                  {formatPrice(trade.price)}
                </div>
                <div className="text-right">{formatSize(trade.size)}</div>
                <div className="text-right text-muted-foreground">
                  {formatTimestamp(trade.created_at)}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
