'use client'

import { FC, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { useTradingStore } from '@/lib/stores/trading'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { formatPrice, formatSize, formatTimestamp, cn } from '@/lib/utils'
import { X, FileText, Wallet } from 'lucide-react'
import { createCancelOrderTransaction } from '@/lib/solana/orders'

export const OpenOrders: FC = () => {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const openOrders = useTradingStore((state) => state.openOrders)
  const setOpenOrders = useTradingStore((state) => state.setOpenOrders)
  const selectedMarket = useTradingStore((state) => state.selectedMarket)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const activeOrders = openOrders.filter(
    (o) => o.status === 'pending' || o.status === 'partiallyfilled'
  )

  const handleCancel = async (orderId: string) => {
    if (!publicKey || !selectedMarket) return

    setCancellingId(orderId)
    try {
      // 1. Create on-chain cancel transaction
      const baseMint = new PublicKey(selectedMarket.base_mint)
      const quoteMint = new PublicKey(selectedMarket.quote_mint)

      const tx = await createCancelOrderTransaction(
        connection,
        publicKey,
        baseMint,
        quoteMint,
        new BN(orderId)
      )

      // 2. Sign and send
      const signature = await sendTransaction(tx, connection)
      await connection.confirmTransaction(signature, 'confirmed')

      // 3. Call matching engine to remove from orderbook
      await api.cancelOrder(orderId)
      setOpenOrders(openOrders.filter((o) => o.order_id !== orderId))
    } catch (err) {
      console.error('Failed to cancel order:', err)
    } finally {
      setCancellingId(null)
    }
  }

  if (!publicKey) {
    return (
      <div className="bg-card rounded-2xl border border-white/5">
        <div className="px-4 py-3 border-b border-white/5">
          <h3 className="font-semibold">Open Orders</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <Wallet className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Connect wallet to view orders</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-2xl border border-white/5">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Open Orders</h3>
          {activeOrders.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-pink/20 text-pink text-xs font-medium">
              {activeOrders.length}
            </span>
          )}
        </div>
      </div>

      {activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">No open orders</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Your active orders will appear here</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-white/5">
                <th className="text-left px-4 py-3 font-medium">Side</th>
                <th className="text-right px-4 py-3 font-medium">Price</th>
                <th className="text-right px-4 py-3 font-medium">Size</th>
                <th className="text-right px-4 py-3 font-medium">Filled</th>
                <th className="text-right px-4 py-3 font-medium">Time</th>
                <th className="text-right px-4 py-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map((order) => (
                <tr
                  key={order.order_id}
                  className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                >
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-semibold',
                        order.side === 'buy'
                          ? 'bg-buy/20 text-buy'
                          : 'bg-sell/20 text-sell'
                      )}
                    >
                      {order.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 font-mono">
                    {formatPrice(order.price)}
                  </td>
                  <td className="text-right px-4 py-3 font-mono text-muted-foreground">
                    {formatSize(order.size)}
                  </td>
                  <td className="text-right px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            order.side === 'buy' ? 'bg-buy' : 'bg-sell'
                          )}
                          style={{ width: `${(order.filled / order.size) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10">
                        {((order.filled / order.size) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 text-muted-foreground text-xs">
                    {formatTimestamp(order.created_at)}
                  </td>
                  <td className="text-right px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-sell/20 hover:text-sell"
                      onClick={() => handleCancel(order.order_id)}
                      disabled={cancellingId === order.order_id}
                    >
                      {cancellingId === order.order_id ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
