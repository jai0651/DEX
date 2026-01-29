import { PublicKey } from '@solana/web3.js'
import { BN } from 'bn.js'

const PROGRAM_ID = new PublicKey('3Y2dNgp8WVLTNptUSUZY48cHCkB5wBRKJmDrC9WJspFo')
const MARKET_SEED = Buffer.from('market')
const VAULT_SEED = Buffer.from('vault')
const ORDER_SEED = Buffer.from('order')
const ESCROW_SEED = Buffer.from('escrow')

export function getMarketPDA(baseMint: PublicKey, quoteMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MARKET_SEED, baseMint.toBuffer(), quoteMint.toBuffer()],
    PROGRAM_ID
  )
}

export function getEscrowPDA(market: PublicKey, kind: 'base' | 'quote'): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, market.toBuffer(), Buffer.from(kind)],
    PROGRAM_ID
  )
}

export function getUserVaultPDA(user: PublicKey, market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, user.toBuffer(), market.toBuffer()],
    PROGRAM_ID
  )
}

export function getOrderPDA(orderId: BN): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ORDER_SEED, orderId.toArrayLike(Buffer, 'le', 16)],
    PROGRAM_ID
  )
}

export { PROGRAM_ID }
