'use client'

import { FC, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTradingStore } from '@/lib/stores/trading'
import { api } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { formatPrice, formatSize, formatTimestamp, cn } from '@/lib/utils'
import { X } from 'lucide-react'

export const OpenOrders: FC = () => {
  const { publicKey } = useWallet()
  const openOrders = useTradingStore((state) => state.openOrders)
  const setOpenOrders = useTradingStore((state) => state.setOpenOrders)
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const activeOrders = openOrders.filter(
    (o) => o.status === 'pending' || o.status === 'partiallyfilled'
  )

  const handleCancel = async (orderId: number) => {
    setCancellingId(orderId)
    try {
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
      <div className="bg-card rounded-lg p-4">
        <h3 className="font-semibold mb-4">Open Orders</h3>
        <div className="text-center text-muted-foreground text-sm py-8">
          Connect wallet to view orders
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg">
      <div className="p-3 border-b border-border">
        <h3 className="font-semibold">Open Orders ({activeOrders.length})</h3>
      </div>

      {activeOrders.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-8">
          No open orders
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left px-3 py-2 font-medium">Side</th>
                <th className="text-right px-3 py-2 font-medium">Price</th>
                <th className="text-right px-3 py-2 font-medium">Size</th>
                <th className="text-right px-3 py-2 font-medium">Filled</th>
                <th className="text-right px-3 py-2 font-medium">Time</th>
                <th className="text-right px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map((order) => (
                <tr key={order.order_id} className="hover:bg-secondary/50">
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        order.side === 'buy'
                          ? 'bg-buy/20 text-buy'
                          : 'bg-sell/20 text-sell'
                      )}
                    >
                      {order.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-right px-3 py-2">{formatPrice(order.price)}</td>
                  <td className="text-right px-3 py-2">{formatSize(order.size)}</td>
                  <td className="text-right px-3 py-2">
                    {((order.filled / order.size) * 100).toFixed(1)}%
                  </td>
                  <td className="text-right px-3 py-2 text-muted-foreground">
                    {formatTimestamp(order.created_at)}
                  </td>
                  <td className="text-right px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCancel(order.order_id)}
                      disabled={cancellingId === order.order_id}
                    >
                      <X className="h-4 w-4" />
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
