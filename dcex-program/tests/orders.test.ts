import * as anchor from '@coral-xyz/anchor'
import { Program, Idl } from '@coral-xyz/anchor'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { BN } from 'bn.js'
import { describe, it, beforeAll, expect } from 'bun:test'
import * as fs from 'fs'
import * as path from 'path'
import {
  getMarketPDA,
  getEscrowPDA,
  getUserVaultPDA,
  getOrderPDA,
} from './helpers'

const IDL = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../idl/dcex.json'), 'utf-8')
)

const LOCALHOST = 'http://127.0.0.1:8899'

describe('on-chain orders', () => {
  const connection = new Connection(LOCALHOST, 'confirmed')
  const authority = Keypair.generate()
  let program: Program<Idl>
  let baseMint: PublicKey
  let quoteMint: PublicKey
  let marketPDA: PublicKey
  let baseVaultPDA: PublicKey
  let quoteVaultPDA: PublicKey
  let userVaultPDA: PublicKey = null!
  const minOrderSize = new BN(1_000_000_000)
  const tickSize = new BN(1_000_000_000)
  const baseDecimals = 9
  const quoteDecimals = 9

  beforeAll(async () => {
    const airdropSig = await connection.requestAirdrop(
      authority.publicKey,
      10 * LAMPORTS_PER_SOL
    )
    const latestBlockhash = await connection.getLatestBlockhash()
    await connection.confirmTransaction({
      signature: airdropSig,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    })

    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(authority),
      { commitment: 'confirmed' }
    )
    anchor.setProvider(provider)
    program = new Program(IDL as Idl, provider)

    baseMint = await createMint(
      connection,
      authority,
      authority.publicKey,
      null,
      baseDecimals,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    )
    quoteMint = await createMint(
      connection,
      authority,
      authority.publicKey,
      null,
      quoteDecimals,
      undefined,
      undefined,
      TOKEN_PROGRAM_ID
    )

      ;[marketPDA] = getMarketPDA(baseMint, quoteMint)
      ;[baseVaultPDA] = getEscrowPDA(marketPDA, 'base')
      ;[quoteVaultPDA] = getEscrowPDA(marketPDA, 'quote')

    const feeRecipient = Keypair.generate().publicKey

    await program.methods
      .initializeMarket({
        minOrderSize,
        tickSize,
        makerFeeBps: 0,
        takerFeeBps: 0,
      })
      .accounts({
        authority: authority.publicKey,
        market: marketPDA,
        baseMint,
        quoteMint,
        baseVault: baseVaultPDA,
        quoteVault: quoteVaultPDA,
        feeRecipient,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority])
      .rpc()

    const depositAmount = new BN(10_000_000_000)
    const userBaseAta = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      baseMint,
      authority.publicKey
    )
    const userQuoteAta = await getOrCreateAssociatedTokenAccount(
      connection,
      authority,
      quoteMint,
      authority.publicKey
    )
    await mintTo(
      connection,
      authority,
      baseMint,
      userBaseAta.address,
      authority,
      Number(depositAmount.toString())
    )
    await mintTo(
      connection,
      authority,
      quoteMint,
      userQuoteAta.address,
      authority,
      Number(depositAmount.toString())
    )

    userVaultPDA = getUserVaultPDA(authority.publicKey, marketPDA)[0]
    await program.methods
      .deposit({ amount: depositAmount, isBase: true })
      .accounts({
        user: authority.publicKey,
        market: marketPDA,
        userVault: userVaultPDA,
        userTokenAccount: userBaseAta.address,
        marketVault: baseVaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc()

    await program.methods
      .deposit({ amount: depositAmount, isBase: false })
      .accounts({
        user: authority.publicKey,
        market: marketPDA,
        userVault: userVaultPDA,
        userTokenAccount: userQuoteAta.address,
        marketVault: quoteVaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc()
  })

  it('places a buy order', async () => {
    const orderId = new BN(1)
    const price = new BN(1_000_000_000)
    const size = new BN(1_000_000_000)
    const [orderPDA] = getOrderPDA(orderId)

    await program.methods
      .placeOrder({
        orderId,
        side: { buy: {} },
        price,
        size,
      })
      .accounts({
        user: authority.publicKey,
        market: marketPDA,
        userVault: userVaultPDA,
        order: orderPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc()

    const orderAccount = (await program.account.order.fetch(orderPDA)) as {
      orderId: { toString(): string }
      size: { toString(): string }
      price: { toString(): string }
      filled: { toString(): string }
    }
    expect(orderAccount.orderId.toString()).toBe(orderId.toString())
    expect(orderAccount.size.toString()).toBe(size.toString())
    expect(orderAccount.price.toString()).toBe(price.toString())
    expect(orderAccount.filled.toString()).toBe('0')
  })

  it('places a sell order', async () => {
    const orderId = new BN(2)
    const price = new BN(1_000_000_000)
    const size = new BN(1_000_000_000)
    const [orderPDA] = getOrderPDA(orderId)

    await program.methods
      .placeOrder({
        orderId,
        side: { sell: {} },
        price,
        size,
      })
      .accounts({
        user: authority.publicKey,
        market: marketPDA,
        userVault: userVaultPDA,
        order: orderPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc()

    type BNAndSide = { side: { buy?: object; sell?: object }; size: { toString(): string } }
    const orderAccount = (await program.account.order.fetch(orderPDA)) as BNAndSide
    expect(orderAccount.side.buy === undefined && orderAccount.side.sell !== undefined).toBe(true)
    expect(orderAccount.size.toString()).toBe(size.toString())
  })

  it('cancels an order and unlocks vault', async () => {
    const orderId = new BN(3)
    const price = new BN(1_000_000_000)
    const size = new BN(1_000_000_000)
    const [orderPDA] = getOrderPDA(orderId)

    await program.methods
      .placeOrder({
        orderId,
        side: { buy: {} },
        price,
        size,
      })
      .accounts({
        user: authority.publicKey,
        market: marketPDA,
        userVault: userVaultPDA,
        order: orderPDA,
        systemProgram: SystemProgram.programId,
      })
      .signers([authority])
      .rpc()

    await program.methods
      .cancelOrder()
      .accounts({
        user: authority.publicKey,
        market: marketPDA,
        userVault: userVaultPDA,
        order: orderPDA,
      })
      .signers([authority])
      .rpc()

    const orderAccount = (await program.account.order.fetch(orderPDA)) as {
      status: { cancelled?: object }
    }
    expect(orderAccount.status.cancelled !== undefined).toBe(true)
  })

  it('rejects order below min size', async () => {
    const orderId = new BN(100)
    const [orderPDA] = getOrderPDA(orderId)
    const tooSmall = new BN(100)

    await expect(
      program.methods
        .placeOrder({
          orderId,
          side: { buy: {} },
          price: tickSize,
          size: tooSmall,
        })
        .accounts({
          user: authority.publicKey,
          market: marketPDA,
          userVault: userVaultPDA,
          order: orderPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc()
    ).rejects.toThrow()
  })

  it('rejects price not aligned to tick', async () => {
    const orderId = new BN(101)
    const [orderPDA] = getOrderPDA(orderId)
    const badPrice = new BN(1_000_000_001)

    await expect(
      program.methods
        .placeOrder({
          orderId,
          side: { buy: {} },
          price: badPrice,
          size: minOrderSize,
        })
        .accounts({
          user: authority.publicKey,
          market: marketPDA,
          userVault: userVaultPDA,
          order: orderPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc()
    ).rejects.toThrow()
  })
})
