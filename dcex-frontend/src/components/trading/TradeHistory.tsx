'use client'

import { FC } from 'react'
import { useTradingStore } from '@/lib/stores/trading'
import { formatPrice, formatSize, formatTimestamp, cn } from '@/lib/utils'
import { Activity } from 'lucide-react'

export const TradeHistory: FC = () => {
  const trades = useTradingStore((state) => state.trades)

  return (
    <div className="bg-card rounded-2xl border border-white/5 h-full min-h-[300px] flex flex-col">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-semibold">Recent Trades</h3>
        <Activity className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-3 text-xs text-muted-foreground px-4 py-2 border-b border-white/5">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Time</div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
              <Activity className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">No recent trades</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Trades will appear here</p>
          </div>
        ) : (
          trades.map((trade) => {
            const isBuy = trade.taker_wallet !== trade.maker_wallet
            return (
              <div
                key={trade.id}
                className="grid grid-cols-3 text-sm px-4 py-2 hover:bg-white/5 transition-colors"
              >
                <div className={cn(
                  'font-medium',
                  isBuy ? 'text-buy' : 'text-sell'
                )}>
                  {formatPrice(trade.price)}
                </div>
                <div className="text-right font-mono text-muted-foreground">
                  {formatSize(trade.size)}
                </div>
                <div className="text-right text-muted-foreground/70 text-xs">
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
