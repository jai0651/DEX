# DCEX Solana Program — Detailed Technical Explanation

This document explains how the DCEX decentralized exchange Solana program works: PDAs (Program Derived Addresses), CPIs (Cross-Program Invocations), account model, and instruction flow.

---

## 1. Overview

The program is an **Anchor** Solana program that implements a spot DEX:

- **Markets**: One market per (base_mint, quote_mint) pair.
- **User vaults**: Per-user, per-market balance ledger (base/quote, available/locked).
- **Orders**: Limit orders (buy/sell) with price, size, and fill state.
- **Settlement**: Authority-led settlement between maker and taker orders with fees.

Tokens are pooled in **market escrow PDAs** (base_vault, quote_vault). User balances are **bookkeeping only** in `UserVault`; real SPL tokens sit in those escrow token accounts.

---

## 2. Program-Derived Addresses (PDAs)

PDAs are addresses derived from seeds and the program id. Only the program can “sign” for them (by providing the same seeds), so they act as program-controlled accounts.

### 2.1 Seeds (constants.rs)

```text
MARKET_SEED  = b"market"
VAULT_SEED   = b"vault"
ORDER_SEED   = b"order"
ESCROW_SEED  = b"escrow"
```

### 2.2 Market PDA

- **Seeds**: `[MARKET_SEED, base_mint, quote_mint]`
- **Purpose**: One global account per (base_mint, quote_mint) storing market config and escrow references.
- **Used as signer**: Yes — it is the **authority** of the base and quote escrow token accounts. Withdraw and fee transfer CPIs use the market PDA as signer.
- **Stored bump**: `market.bump` so clients can recompute the address without trying multiple bumps.

**Derivation**:  
`market_pda = PDA(program_id, [b"market", base_mint, quote_mint])`

### 2.3 User Vault PDA

- **Seeds**: `[VAULT_SEED, user_pubkey, market_pubkey]`
- **Purpose**: Per-user, per-market balance ledger (base/quote balances and locked amounts for open orders).
- **Used as signer**: No. It is data only.
- **Stored bump**: `user_vault.bump` for constraint `bump = user_vault.bump` in later instructions.

**Derivation**:  
`user_vault_pda = PDA(program_id, [b"vault", user.key(), market.key()])`

### 2.4 Order PDA

- **Seeds**: `[ORDER_SEED, order_id.to_le_bytes()]`
- **Purpose**: One account per order (order_id must be unique).
- **Used as signer**: No.
- **Stored bump**: `order.bump` for validation in cancel and settle.

**Derivation**:  
`order_pda = PDA(program_id, [b"order", order_id_le_bytes])`

### 2.5 Escrow PDAs (Base & Quote Vaults)

- **Base vault seeds**: `[ESCROW_SEED, market.key(), b"base"]`
- **Quote vault seeds**: `[ESCROW_SEED, market.key(), b"quote"]`
- **Purpose**: SPL token accounts that hold all base and quote tokens for the market. Authority is the **Market PDA**.
- **Used as signer**: The **market** PDA signs for transfers out of these accounts (withdraw, fees), not the escrow PDAs themselves. The escrow PDAs are created with **CPI**: first `create_account` (system program), then `initialize_account3` (token program) with authority = market PDA.

**Derivation**:  
`base_vault_pda  = PDA(program_id, [b"escrow", market.key(), b"base"])`  
`quote_vault_pda = PDA(program_id, [b"escrow", market.key(), b"quote"])`

### 2.6 PDA Summary

| Account    | Seeds                                      | Signer? | Authority of token accounts |
|-----------|---------------------------------------------|--------|-----------------------------|
| Market    | market, base_mint, quote_mint               | Yes    | base_vault, quote_vault    |
| UserVault | vault, user, market                         | No     | —                           |
| Order     | order, order_id (u128 LE bytes)            | No     | —                           |
| BaseVault | escrow, market, "base"                      | No     | — (owned by market PDA)    |
| QuoteVault| escrow, market, "quote"                     | No     | — (owned by market PDA)    |

---

## 3. Cross-Program Invocations (CPIs)

The program calls the **System Program** and the **Token Program**; it never calls another custom program.

### 3.1 initialize_market — Creating escrow token accounts

The market account is created by Anchor (`init`). The base and quote vaults are **raw PDAs** (AccountInfo) and are created and initialized via CPI.

**Step 1 — Allocate account (System Program)**  
- **CPI**: `system_program::create_account`
- **From**: authority (payer)  
- **To**: base_vault PDA (then same for quote_vault)
- **Signer**: The **escrow PDA** must sign so the program can pay for the account. Seeds passed: `[ESCROW_SEED, market.key(), "base", bump]` (and similarly for quote).
- **Space**: `TokenAccount::LEN`, **Owner**: token program (so it’s a valid SPL token account).

**Step 2 — Initialize as token account (Token Program)**  
- **CPI**: `token::initialize_account3`
- **Account**: the new base_vault/quote_vault account
- **Mint**: base_mint or quote_mint
- **Authority**: **market PDA** (so only the program, signing with market seeds, can move tokens from these accounts).
- **Signer**: None for this CPI.

So: **Escrow PDA** signs for `create_account`; **Market PDA** is the token account authority used later for withdraw and fee CPIs.

### 3.2 deposit — User deposits into market

- **CPI**: `token::transfer`
- **From**: user’s token account  
- **To**: market base_vault or quote_vault (depending on `is_base`)
- **Authority**: **user** (signer).
- **Signer**: None (user is transaction signer).

Then the handler increases `user_vault.base_balance` or `user_vault.quote_balance` (and totals). No PDA signer needed; user signs the transfer.

### 3.3 withdraw — User withdraws from market

- **CPI**: `token::transfer`
- **From**: market base_vault or quote_vault  
- **To**: user’s token account
- **Authority**: **market PDA** (vaults are owned by market PDA).
- **Signer**: **Market PDA** — seeds `[MARKET_SEED, base_mint, quote_mint, market.bump]` via `CpiContext::new_with_signer`.

Handler first decreases `user_vault.base_balance` or `user_vault.quote_balance` (and updates totals), then does the transfer. Without the market PDA signer, the token program would reject the transfer.

### 3.4 settle_trade — Fee transfer

- **CPI**: `token::transfer` (only when `total_fees > 0`)
- **From**: market **quote_vault**
- **To**: fee_recipient token account
- **Authority**: **market PDA**
- **Signer**: Same market PDA seeds as in withdraw.

Settlement itself only updates **UserVault** balances (and order fill state). Actual SPL movement happens only for fees; base/quote movements are ledger updates because tokens are already in the escrow vaults.

### 3.5 CPI Summary

| Instruction       | Program         | CPI call                 | Signer      |
|------------------|-----------------|--------------------------|------------|
| initialize_market| System          | create_account (x2)      | Escrow PDA |
| initialize_market| Token           | initialize_account3 (x2) | —          |
| deposit          | Token           | transfer                 | — (user)   |
| withdraw         | Token           | transfer                 | Market PDA |
| settle_trade      | Token           | transfer (fees)          | Market PDA |

---

## 4. Account Layout and State

### 4.1 Market (state/market.rs)

- **Authority**, **base_mint**, **quote_mint**, **base_vault**, **quote_vault**
- **base_decimals**, **quote_decimals**
- **min_order_size**, **tick_size**
- **maker_fee_bps**, **taker_fee_bps**, **fee_recipient**
- **is_active**
- **total_base_deposited**, **total_quote_deposited**
- **bump**

Helpers: `validate_order_size`, `validate_price`, `calculate_maker_fee`, `calculate_taker_fee`.

### 4.2 UserVault (state/user_vault.rs)

- **user**, **market**
- **base_balance**, **quote_balance**, **base_locked**, **quote_locked**
- **total_*_deposited**, **total_*_withdrawn**
- **bump**

Available = balance − locked. **lock_quote** / **lock_base** (place order), **unlock_quote** / **unlock_base** (cancel/settle).

### 4.3 Order (state/order.rs)

- **user**, **market**, **order_id** (u128)
- **side** (Buy/Sell), **price**, **size**, **filled**, **status**
- **created_at**, **updated_at**, **bump**

**remaining** = size − filled. **is_active** = Pending or PartiallyFilled. **fill** / **cancel** update state and time.

---

## 5. Instruction Flow (Under the Hood)

### 5.1 initialize_market

1. Validate fee and market params (maker/taker fee bps, min_order_size, tick_size).
2. Anchor creates **market** PDA with `init` and seeds `[MARKET_SEED, base_mint, quote_mint]`.
3. CPI: create + init **base_vault** PDA as token account, authority = market PDA.
4. CPI: create + init **quote_vault** PDA as token account, authority = market PDA.
5. Fill market fields (mints, vaults, decimals, fees, fee_recipient, bump, is_active = true).

Result: One market account and two escrow token accounts, both controlled by the market PDA.

### 5.2 deposit

1. Require market active, amount > 0.
2. Resolve or create **user_vault** PDA (`init_if_needed`) with seeds `[VAULT_SEED, user, market]`.
3. Constrain user_token_account and market_vault (owner, mint matches market base or quote).
4. CPI: **token::transfer** from user → market_vault (user signs).
5. Update user_vault: add to base_balance or quote_balance and total_*_deposited.

So: tokens move on-chain into escrow; user_vault is the in-program ledger.

### 5.3 withdraw

1. Require amount > 0 and correct mint/vault pairing (base vs quote).
2. Require user_vault.available_base() or available_quote() ≥ amount.
3. Decrease user_vault balance and increase total_*_withdrawn.
4. CPI: **token::transfer** from market_vault → user, authority = **market PDA**, with **CpiContext::new_with_signer** using market seeds.

So: program “signs” as market PDA to move tokens from escrow back to the user.

### 5.4 place_order

1. Validate market active, order size ≥ min_order_size, price aligned to tick_size.
2. Compute quote_amount = size * price / 10^base_decimals.
3. Load or ensure **user_vault** PDA; **lock** quote (buy) or base (sell) in user_vault.
4. Create **order** PDA with `init`, seeds `[ORDER_SEED, order_id.to_le_bytes()]`.
5. Set order fields (user, market, side, price, size, filled=0, status=Pending, timestamps, bump).

No CPI: only PDA creation and user_vault balance locking.

### 5.5 cancel_order

1. Require order is active (Pending or PartiallyFilled).
2. Compute remaining size and quote_amount for remaining.
3. **user_vault**: unlock_quote (buy) or unlock_base (sell) for remaining.
4. Set order status to Cancelled and updated_at.

No CPI; only state updates.

### 5.6 settle_trade

1. Require market active, authority = market.authority.
2. Load maker_vault, taker_vault, maker_order, taker_order (all via PDA seeds).
3. Require both orders active and remaining ≥ fill_size.
4. Compute base_amount = fill_size, quote_amount = fill_size * fill_price / 10^base_decimals.
5. Compute maker_fee, taker_fee, total_fees (quote_mint).
6. **Maker sell**: unlock maker base, decrease maker base_balance, add (quote − maker_fee) to maker quote_balance; decrease taker quote_balance (including taker_fee), add base to taker base_balance.
7. **Maker buy**: mirror (unlock maker quote, give maker base; take taker base, give taker quote minus fee).
8. If total_fees > 0: CPI **token::transfer** from **quote_vault** to **fee_recipient**, authority = **market PDA**, with signer seeds.
9. **fill**(fill_size) on both orders.

So: settlement is mostly UserVault bookkeeping; the only SPL move is fees from quote_vault to fee_recipient, signed by the market PDA.

---

## 6. Why This Design

- **PDAs**:  
  - **Market**: Deterministic address per pair; holds config and is the single signer for escrow.  
  - **UserVault**: Deterministic per (user, market); no need to pass vault address.  
  - **Order**: Deterministic per order_id; client can derive order address.  
  - **Escrow**: Deterministic per market; all liquidity in two token accounts per market.

- **CPIs**:  
  - System + Token for creating and owning escrow token accounts.  
  - Token for deposit (user → escrow), withdraw (escrow → user), and fee payout (escrow → fee_recipient).  
  - Escrow creation needs escrow PDA as signer for rent; all transfers out of escrow need market PDA as signer.

- **Ledger vs on-chain tokens**:  
  UserVault balances are the source of truth for “user’s balance in this market.” Actual SPL tokens sit in base_vault and quote_vault. Deposit/withdraw move tokens and update the ledger; place_order/cancel_order only lock/unlock in the ledger; settle_trade updates ledger and only moves tokens for fees.

---

## 7. Client-Side PDA Derivation (Reference)

```typescript
// Market
const [marketPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("market"), baseMint.toBuffer(), quoteMint.toBuffer()],
  programId
);

// User vault
const [userVaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), user.toBuffer(), marketPda.toBuffer()],
  programId
);

// Order
const orderIdBytes = new BN(orderId).toArrayLike(Buffer, "le", 16);
const [orderPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("order"), orderIdBytes],
  programId
);

// Escrows (for deposit/withdraw)
const [baseVaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("escrow"), marketPda.toBuffer(), Buffer.from("base")],
  programId
);
const [quoteVaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("escrow"), marketPda.toBuffer(), Buffer.from("quote")],
  programId
);
```

---

## 8. File Map

| File / area              | Role |
|--------------------------|------|
| lib.rs                   | Program id, instruction entrypoints |
| state/market.rs          | Market account and helpers |
| state/user_vault.rs      | UserVault account and lock/unlock |
| state/order.rs           | Order account and fill/cancel |
| constants.rs             | PDA seeds, fee and order limits |
| errors.rs                | Error codes |
| instructions/initialize_market.rs | Market + escrow creation, CPIs |
| instructions/deposit.rs  | User → escrow transfer CPI, vault ledger |
| instructions/withdraw.rs | Escrow → user transfer CPI (market signer) |
| instructions/place_order.rs | UserVault lock, Order PDA init |
| instructions/cancel_order.rs | UserVault unlock, order cancel |
| instructions/settle_trade.rs | Maker/taker vault updates, fee CPI (market signer) |

This is the full picture of PDAs, CPIs, and how the DCEX Solana program works under the hood.
