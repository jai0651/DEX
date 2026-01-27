'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWallet } from '@solana/wallet-adapter-react'
import { api } from '@/lib/api/client'
import { useTradingStore } from '@/lib/stores/trading'

export function useOrders(marketId: string | undefined) {
  const { publicKey } = useWallet()
  const setOpenOrders = useTradingStore((state) => state.setOpenOrders)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', publicKey?.toBase58(), marketId],
    queryFn: () =>
      publicKey ? api.getUserOrders(publicKey.toBase58(), marketId) : [],
    enabled: !!publicKey,
    refetchInterval: 10000,
  })

  useEffect(() => {
    if (data) {
      setOpenOrders(data)
    }
  }, [data, setOpenOrders])

  return { isLoading, error, refetch }
}
