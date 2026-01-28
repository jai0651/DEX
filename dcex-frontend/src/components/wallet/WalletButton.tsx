'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { FC, useCallback, useState, useRef, useEffect } from 'react'
import { ChevronDown, Copy, LogOut, Check, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

export const WalletButton: FC = () => {
  const { publicKey, disconnect, connected, wallet } = useWallet()
  const { setVisible } = useWalletModal()
  const [showDropdown, setShowDropdown] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleClick = useCallback(() => {
    if (connected) {
      setShowDropdown(!showDropdown)
    } else {
      setVisible(true)
    }
  }, [connected, showDropdown, setVisible])

  const handleCopy = useCallback(() => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [publicKey])

  const handleDisconnect = useCallback(() => {
    disconnect()
    setShowDropdown(false)
  }, [disconnect])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleClick}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all',
          connected
            ? 'bg-card hover:bg-card-hover border border-white/5'
            : 'bg-gradient-pink text-white hover:opacity-90 shadow-glow hover:shadow-glow-strong'
        )}
      >
        {connected && publicKey ? (
          <>
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink to-purple-500" />
            <span className="text-sm">{formatAddress(publicKey.toBase58())}</span>
            <ChevronDown className={cn(
              'w-4 h-4 text-muted-foreground transition-transform',
              showDropdown && 'rotate-180'
            )} />
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            <span className="text-sm">Connect Wallet</span>
          </>
        )}
      </button>

      {showDropdown && connected && publicKey && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-xl border border-white/10 shadow-xl overflow-hidden z-50">
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink to-purple-500" />
              <div>
                <p className="font-semibold">{formatAddress(publicKey.toBase58())}</p>
                <p className="text-xs text-muted-foreground">
                  {wallet?.adapter.name || 'Wallet'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-buy" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm">{copied ? 'Copied!' : 'Copy Address'}</span>
            </button>

            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sell/10 text-sell transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Disconnect</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
