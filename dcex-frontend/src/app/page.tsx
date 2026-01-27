'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.push('/market/SOL-USDC')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-lg">Loading DCEX...</div>
    </div>
  )
}
