'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { FC, useCallback } from 'react'

export const WalletButton: FC = () => {
  const { publicKey, disconnect, connected } = useWallet()
  const { setVisible } = useWalletModal()

  const handleClick = useCallback(() => {
    if (connected) {
      disconnect()
    } else {
      setVisible(true)
    }
  }, [connected, disconnect, setVisible])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <button
      onClick={handleClick}
      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
    >
      {connected && publicKey
        ? formatAddress(publicKey.toBase58())
        : 'Connect Wallet'}
    </button>
  )
}
