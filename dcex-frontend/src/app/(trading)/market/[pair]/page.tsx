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
import { TrendingUp, Activity, BarChart3, Settings } from 'lucide-react'

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
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-white/5">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-pink flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-pink to-white bg-clip-text text-transparent">
                  DCEX
                </h1>
              </div>

              <nav className="hidden md:flex items-center gap-1">
                <NavLink active>Trade</NavLink>
                <NavLink>Explore</NavLink>
                <NavLink>Pool</NavLink>
                <NavLink>Portfolio</NavLink>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-6 px-4 py-2 rounded-xl bg-card border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">
                    {baseToken}/{quoteToken}
                  </span>
                  {orderbook?.last_price && (
                    <span className="text-lg font-bold">
                      ${formatPrice(orderbook.last_price)}
                    </span>
                  )}
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      isConnected ? 'bg-buy animate-pulse' : 'bg-sell'
                    )}
                  />
                  <span className="text-xs text-muted-foreground">
                    {isConnected ? 'Live' : 'Offline'}
                  </span>
                </div>
              </div>

              <button className="p-2.5 rounded-xl bg-card hover:bg-card-hover border border-white/5 transition-colors">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </button>

              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
          <div className="lg:col-span-3 order-2 lg:order-1">
            <Orderbook onPriceClick={handlePriceClick} />
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2 flex flex-col gap-4 lg:gap-5">
            <div className="bg-card rounded-2xl border border-white/5 flex-1 min-h-[300px] lg:min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Price Chart</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  TradingView integration coming soon
                </p>
              </div>
            </div>

            <OpenOrders />
          </div>

          <div className="lg:col-span-3 order-3 flex flex-col gap-4 lg:gap-5">
            <OrderForm initialPrice={selectedPrice} />
            <TradeHistory />
          </div>
        </div>
      </main>
    </div>
  )
}

function NavLink({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
        active
          ? 'bg-card text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
      )}
    >
      {children}
    </button>
  )
}
