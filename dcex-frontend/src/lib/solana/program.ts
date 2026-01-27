import { Program, AnchorProvider, Idl, BN } from '@coral-xyz/anchor'
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'
)

export const MARKET_SEED = Buffer.from('market')
export const VAULT_SEED = Buffer.from('vault')
export const ORDER_SEED = Buffer.from('order')
export const ESCROW_SEED = Buffer.from('escrow')

export function getMarketPDA(baseMint: PublicKey, quoteMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MARKET_SEED, baseMint.toBuffer(), quoteMint.toBuffer()],
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

export function getEscrowPDA(market: PublicKey, tokenType: 'base' | 'quote'): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, market.toBuffer(), Buffer.from(tokenType)],
    PROGRAM_ID
  )
}

export interface MarketConfig {
  baseMint: PublicKey
  quoteMint: PublicKey
  baseDecimals: number
  quoteDecimals: number
  minOrderSize: BN
  tickSize: BN
  makerFeeBps: number
  takerFeeBps: number
}

export interface UserVaultState {
  user: PublicKey
  market: PublicKey
  baseBalance: BN
  quoteBalance: BN
  baseLocked: BN
  quoteLocked: BN
}

export class DcexClient {
  private connection: Connection
  private programId: PublicKey

  constructor(connection: Connection) {
    this.connection = connection
    this.programId = PROGRAM_ID
  }

  async getMarket(baseMint: PublicKey, quoteMint: PublicKey) {
    const [marketPDA] = getMarketPDA(baseMint, quoteMint)
    const accountInfo = await this.connection.getAccountInfo(marketPDA)
    return accountInfo
  }

  async getUserVault(user: PublicKey, market: PublicKey) {
    const [vaultPDA] = getUserVaultPDA(user, market)
    const accountInfo = await this.connection.getAccountInfo(vaultPDA)
    return accountInfo
  }

  getDepositInstruction(
    user: PublicKey,
    market: PublicKey,
    userTokenAccount: PublicKey,
    marketVault: PublicKey,
    amount: BN,
    isBase: boolean
  ) {
    const [userVaultPDA] = getUserVaultPDA(user, market)
    
    return {
      programId: this.programId,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: market, isSigner: false, isWritable: false },
        { pubkey: userVaultPDA, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: marketVault, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        Buffer.from([1]),
        amount.toArrayLike(Buffer, 'le', 8),
        Buffer.from([isBase ? 1 : 0]),
      ]),
    }
  }

  getWithdrawInstruction(
    user: PublicKey,
    market: PublicKey,
    userTokenAccount: PublicKey,
    marketVault: PublicKey,
    amount: BN,
    isBase: boolean
  ) {
    const [userVaultPDA] = getUserVaultPDA(user, market)
    
    return {
      programId: this.programId,
      keys: [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: market, isSigner: false, isWritable: false },
        { pubkey: userVaultPDA, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: marketVault, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([
        Buffer.from([2]),
        amount.toArrayLike(Buffer, 'le', 8),
        Buffer.from([isBase ? 1 : 0]),
      ]),
    }
  }
}
