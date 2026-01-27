'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { wsClient } from '@/lib/api/websocket'
import { useTradingStore } from '@/lib/stores/trading'

export function useOrderbook(marketId: string | undefined) {
  const setOrderbook = useTradingStore((state) => state.setOrderbook)

  const { data, isLoading, error } = useQuery({
    queryKey: ['orderbook', marketId],
    queryFn: () => (marketId ? api.getOrderbook(marketId) : null),
    enabled: !!marketId,
    refetchInterval: false,
  })

  useEffect(() => {
    if (data) {
      setOrderbook(data)
    }
  }, [data, setOrderbook])

  useEffect(() => {
    if (!marketId) return

    wsClient.connect()
    wsClient.subscribe(marketId)

    return () => {
      wsClient.unsubscribe(marketId)
    }
  }, [marketId])

  return { isLoading, error }
}
