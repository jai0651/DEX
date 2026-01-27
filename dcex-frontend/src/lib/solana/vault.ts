import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { DcexClient, getMarketPDA, getUserVaultPDA, getEscrowPDA } from './program'

export interface VaultBalance {
  baseBalance: number
  quoteBalance: number
  baseLocked: number
  quoteLocked: number
  baseAvailable: number
  quoteAvailable: number
}

export async function getVaultBalance(
  connection: Connection,
  user: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey
): Promise<VaultBalance | null> {
  const [marketPDA] = getMarketPDA(baseMint, quoteMint)
  const [vaultPDA] = getUserVaultPDA(user, marketPDA)
  
  const accountInfo = await connection.getAccountInfo(vaultPDA)
  
  if (!accountInfo) {
    return null
  }

  const data = accountInfo.data
  const baseBalance = new BN(data.slice(72, 80), 'le').toNumber()
  const quoteBalance = new BN(data.slice(80, 88), 'le').toNumber()
  const baseLocked = new BN(data.slice(88, 96), 'le').toNumber()
  const quoteLocked = new BN(data.slice(96, 104), 'le').toNumber()
  
  return {
    baseBalance,
    quoteBalance,
    baseLocked,
    quoteLocked,
    baseAvailable: baseBalance - baseLocked,
    quoteAvailable: quoteBalance - quoteLocked,
  }
}

export async function createDepositTransaction(
  connection: Connection,
  user: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  amount: number,
  isBase: boolean,
  userTokenAccount: PublicKey
): Promise<Transaction> {
  const client = new DcexClient(connection)
  const [marketPDA] = getMarketPDA(baseMint, quoteMint)
  const [escrowPDA] = getEscrowPDA(marketPDA, isBase ? 'base' : 'quote')
  
  const instruction = client.getDepositInstruction(
    user,
    marketPDA,
    userTokenAccount,
    escrowPDA,
    new BN(amount),
    isBase
  )

  const transaction = new Transaction()
  transaction.add({
    keys: instruction.keys,
    programId: instruction.programId,
    data: instruction.data,
  })

  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = user

  return transaction
}

export async function createWithdrawTransaction(
  connection: Connection,
  user: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  amount: number,
  isBase: boolean,
  userTokenAccount: PublicKey
): Promise<Transaction> {
  const client = new DcexClient(connection)
  const [marketPDA] = getMarketPDA(baseMint, quoteMint)
  const [escrowPDA] = getEscrowPDA(marketPDA, isBase ? 'base' : 'quote')
  
  const instruction = client.getWithdrawInstruction(
    user,
    marketPDA,
    userTokenAccount,
    escrowPDA,
    new BN(amount),
    isBase
  )

  const transaction = new Transaction()
  transaction.add({
    keys: instruction.keys,
    programId: instruction.programId,
    data: instruction.data,
  })

  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = user

  return transaction
}
