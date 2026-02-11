import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { DcexClient, getMarketPDA, getUserVaultPDA, getOrderPDA } from './program'

export async function createPlaceOrderTransaction(
  connection: Connection,
  user: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  orderId: BN, // u128
  side: 'buy' | 'sell',
  price: BN,
  size: BN
): Promise<Transaction> {
  const client = new DcexClient(connection)
  const [marketPDA] = getMarketPDA(baseMint, quoteMint)
  const [userVaultPDA] = getUserVaultPDA(user, marketPDA)
  const [orderPDA] = getOrderPDA(orderId)
  
  const instruction = client.getPlaceOrderInstruction(
    user,
    marketPDA,
    userVaultPDA,
    orderPDA,
    orderId,
    side,
    price,
    size
  )
  
  const transaction = new Transaction()
  transaction.add(instruction)
  
  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = user
  
  return transaction
}

export async function createCancelOrderTransaction(
  connection: Connection,
  user: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  orderId: BN
): Promise<Transaction> {
  const client = new DcexClient(connection)
  const [marketPDA] = getMarketPDA(baseMint, quoteMint)
  const [userVaultPDA] = getUserVaultPDA(user, marketPDA)
  const [orderPDA] = getOrderPDA(orderId)

  const instruction = client.getCancelOrderInstruction(
    user,
    marketPDA,
    userVaultPDA,
    orderPDA
  )

  const transaction = new Transaction()
  transaction.add(instruction)

  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = user

  return transaction
}
