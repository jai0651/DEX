'use client'

import { FC, useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTradingStore } from '@/lib/stores/trading'
import { api } from '@/lib/api/client'
import { cn, formatNumber } from '@/lib/utils'
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
    <div className="bg-card rounded-lg p-4">
      <div className="flex gap-2 mb-4">
        <Button
          variant={side === 'buy' ? 'buy' : 'ghost'}
          className={cn('flex-1', side !== 'buy' && 'text-muted-foreground')}
          onClick={() => setSide('buy')}
        >
          Buy
        </Button>
        <Button
          variant={side === 'sell' ? 'sell' : 'ghost'}
          className={cn('flex-1', side !== 'sell' && 'text-muted-foreground')}
          onClick={() => setSide('sell')}
        >
          Sell
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Price (USDC)</label>
          <Input
            type="number"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            step="0.01"
            min="0"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Size (SOL)</label>
          <Input
            type="number"
            placeholder="0.0000"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            step="0.0001"
            min="0"
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span>{formatNumber(total, 2)} USDC</span>
        </div>

        {error && (
          <div className="text-sell text-sm">{error}</div>
        )}

        <Button
          variant={side === 'buy' ? 'buy' : 'sell'}
          className="w-full"
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
