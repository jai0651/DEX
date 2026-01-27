'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { WalletContextProvider } from '@/components/wallet/WalletProvider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
