'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { useTradingStore } from '@/lib/stores/trading'

export function useMarket(marketId: string | undefined) {
  const setSelectedMarket = useTradingStore((state) => state.setSelectedMarket)
  const setTrades = useTradingStore((state) => state.setTrades)

  const { data: market, isLoading: marketLoading } = useQuery({
    queryKey: ['market', marketId],
    queryFn: () => (marketId ? api.getMarket(marketId) : null),
    enabled: !!marketId,
  })

  const { data: trades, isLoading: tradesLoading } = useQuery({
    queryKey: ['trades', marketId],
    queryFn: () => (marketId ? api.getTrades(marketId) : []),
    enabled: !!marketId,
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (market) {
      setSelectedMarket(market)
    }
  }, [market, setSelectedMarket])

  useEffect(() => {
    if (trades) {
      setTrades(trades)
    }
  }, [trades, setTrades])

  return {
    market,
    isLoading: marketLoading || tradesLoading,
  }
}
