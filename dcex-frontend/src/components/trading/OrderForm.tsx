'use client'

import { FC, useState, useCallback, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Button } from '@/components/ui/button'
import { useTradingStore } from '@/lib/stores/trading'
import { api } from '@/lib/api/client'
import { cn, formatNumber } from '@/lib/utils'
import { ArrowDownUp, ChevronDown, AlertCircle } from 'lucide-react'
import type { OrderSide } from '@/types/trading'

interface OrderFormProps {
  initialPrice?: number
}

export const OrderForm: FC<OrderFormProps> = ({ initialPrice }) => {
  const { publicKey, connected } = useWallet()
  const selectedMarket = useTradingStore((state) => state.selectedMarket)
  
  const [side, setSide] = useState<OrderSide>('buy')
  const [price, setPrice] = useState(initialPrice?.toString() || '')
  const [size, setSize] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialPrice !== undefined) {
      setPrice(initialPrice.toString())
    }
  }, [initialPrice])

  const total = price && size ? parseFloat(price) * parseFloat(size) : 0

  const handleSubmit = useCallback(async () => {
    if (!connected || !publicKey || !selectedMarket) {
      setError('Please connect your wallet')
      return
    }

    if (!price || !size) {
      setError('Please enter price and size')
      return
    }

    const priceNum = parseFloat(price)
    const sizeNum = parseFloat(size)

    if (priceNum <= 0 || sizeNum <= 0) {
      setError('Price and size must be positive')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const priceUnits = Math.floor(priceNum * 1e9)
      const sizeUnits = Math.floor(sizeNum * 1e9)

      const result = await api.placeOrder({
        market_id: selectedMarket.id,
        side,
        price: priceUnits,
        size: sizeUnits,
        wallet: publicKey.toBase58(),
        signature: '',
      })

      setPrice('')
      setSize('')
      console.log('Order placed:', result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setIsSubmitting(false)
    }
  }, [connected, publicKey, selectedMarket, price, size, side])

  return (
    <div className="bg-card rounded-2xl border border-white/5 p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex bg-muted rounded-xl p-1">
          <button
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              side === 'buy'
                ? 'bg-buy text-white shadow-lg'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setSide('buy')}
          >
            Buy
          </button>
          <button
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              side === 'sell'
                ? 'bg-sell text-white shadow-lg'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setSide('sell')}
          >
            Sell
          </button>
        </div>
        <span className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-muted">
          Limit
        </span>
      </div>

      <div className="space-y-3">
        <div className="bg-secondary rounded-xl p-4 transition-all hover:bg-muted focus-within:ring-1 focus-within:ring-pink/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-foreground">Price</span>
            <span className="text-xs text-muted-foreground">USDC</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="flex-1 bg-transparent text-2xl font-semibold outline-none placeholder:text-muted-foreground/50"
              step="0.01"
              min="0"
            />
            <button className="flex items-center gap-1 px-3 py-2 rounded-xl bg-card hover:bg-card-hover transition-colors">
              <span className="text-sm font-medium">USDC</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex justify-center -my-1 relative z-10">
          <button className="p-2 rounded-xl bg-muted border-4 border-card hover:bg-secondary transition-colors">
            <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="bg-secondary rounded-xl p-4 transition-all hover:bg-muted focus-within:ring-1 focus-within:ring-pink/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-foreground">Amount</span>
            <span className="text-xs text-muted-foreground">SOL</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="0.0000"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="flex-1 bg-transparent text-2xl font-semibold outline-none placeholder:text-muted-foreground/50"
              step="0.0001"
              min="0"
            />
            <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card hover:bg-card-hover transition-colors">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]" />
              <span className="text-sm font-medium">SOL</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {(total > 0 || error) && (
          <div className="px-1 space-y-2">
            {total > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{formatNumber(total, 2)} USDC</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sell text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        <Button
          variant={side === 'buy' ? 'buy' : 'sell'}
          size="xl"
          className="w-full mt-2"
          onClick={handleSubmit}
          disabled={isSubmitting || !connected}
        >
          {isSubmitting
            ? 'Placing Order...'
            : connected
            ? `${side === 'buy' ? 'Buy' : 'Sell'} SOL`
            : 'Connect Wallet'}
        </Button>
      </div>
    </div>
  )
}
