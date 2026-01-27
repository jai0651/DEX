'use client'

import { useParams } from 'next/navigation'
import { useState, useCallback } from 'react'
import { WalletButton } from '@/components/wallet/WalletButton'
import { Orderbook } from '@/components/trading/Orderbook'
import { OrderForm } from '@/components/trading/OrderForm'
import { TradeHistory } from '@/components/trading/TradeHistory'
import { OpenOrders } from '@/components/trading/OpenOrders'
import { useOrderbook } from '@/lib/hooks/useOrderbook'
import { useOrders } from '@/lib/hooks/useOrders'
import { useMarket } from '@/lib/hooks/useMarket'
import { useTradingStore } from '@/lib/stores/trading'
import { formatPrice, cn } from '@/lib/utils'

const DEMO_MARKET_ID = '00000000-0000-0000-0000-000000000001'

export default function TradingPage() {
  const params = useParams()
  const pair = params.pair as string
  const [selectedPrice, setSelectedPrice] = useState<number | undefined>()
  
  const orderbook = useTradingStore((state) => state.orderbook)
  const isConnected = useTradingStore((state) => state.isConnected)

  useMarket(DEMO_MARKET_ID)
  useOrderbook(DEMO_MARKET_ID)
  useOrders(DEMO_MARKET_ID)

  const handlePriceClick = useCallback((price: number) => {
    setSelectedPrice(price / 1e9)
  }, [])

  const [baseToken, quoteToken] = pair?.split('-') || ['SOL', 'USDC']

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold">DCEX</h1>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold">
                {baseToken}/{quoteToken}
              </span>
              {orderbook?.last_price && (
                <span className="text-2xl font-bold">
                  ${formatPrice(orderbook.last_price)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-buy' : 'bg-sell'
                )}
              />
              <span className="text-sm text-muted-foreground">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto p-4">
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-140px)]">
          <div className="col-span-3">
            <Orderbook onPriceClick={handlePriceClick} />
          </div>

          <div className="col-span-6 flex flex-col gap-4">
            <div className="bg-card rounded-lg flex-1 flex items-center justify-center">
              <div className="text-muted-foreground text-center">
                <div className="text-4xl mb-2">📊</div>
                <div>Price Chart</div>
                <div className="text-sm">TradingView integration coming soon</div>
              </div>
            </div>

            <div className="h-[250px]">
              <OpenOrders />
            </div>
          </div>

          <div className="col-span-3 flex flex-col gap-4">
            <OrderForm initialPrice={selectedPrice} />
            <div className="flex-1">
              <TradeHistory />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
