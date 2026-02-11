# Program Derived Addresses (PDAs) - Complete Explanation

This document explains in detail why PDAs are used in the DCEX system, what problems they solve, and how they're used in transactions.

## Table of Contents

1. [What is a PDA?](#what-is-a-pda)
2. [Why Use PDAs?](#why-use-pdas)
3. [Market PDA](#market-pda)
4. [Market Vaults (Escrow Accounts)](#market-vaults-escrow-accounts)
5. [User Vault PDA](#user-vault-pda)
6. [Order PDA](#order-pda)
7. [PDA Signing in Transactions](#pda-signing-in-transactions)
8. [Complete Transaction Examples](#complete-transaction-examples)

---

## What is a PDA?

A **Program Derived Address (PDA)** is a special type of account in Solana that:

1. **Has no private key** - Cannot be controlled by a user wallet
2. **Is deterministically derived** - Same seeds always produce the same address
3. **Can sign transactions** - Programs can "sign" as the PDA using seeds
4. **Is owned by a program** - The program that derives it owns the account

### PDA Derivation Formula

```
PDA = findProgramAddress(seeds, program_id)
```

The seeds are combined with the program ID and hashed. If the result is NOT on the ed25519 curve, it's a valid PDA. If it IS on the curve, the algorithm tries again with a bump seed.

**Example**:
```rust
// Market PDA derivation
let seeds = &[
    b"market",           // MARKET_SEED constant
    base_mint.as_ref(),  // Base token mint address
    quote_mint.as_ref(), // Quote token mint address
];
let (market_pda, bump) = Pubkey::find_program_address(seeds, program_id);
```

**Result**: A deterministic address that:
- Always resolves to the same address for SOL/USDC market
- Can only be controlled by the program
- Can sign transactions when the program provides the seeds

---

## Why Use PDAs?

### Problem 1: Who Owns the Escrow?

**Without PDAs**: You'd need a trusted third party to hold user funds
- Centralized exchange model
- Single point of failure
- Requires trust

**With PDAs**: The program itself controls the escrow
- Decentralized
- No single point of failure
- Trustless (code is law)

### Problem 2: How to Find Accounts?

**Without PDAs**: You'd need to store account addresses somewhere
- Requires external database
- Addresses could be lost
- No deterministic way to find accounts

**With PDAs**: Accounts are deterministically derivable
- Same inputs = same address
- No external storage needed
- Can compute address from known seeds

### Problem 3: Who Signs Transactions?

**Without PDAs**: Only users with private keys can sign
- Programs can't move tokens
- Requires user signatures for every operation
- Poor user experience

**With PDAs**: Programs can sign as PDAs
- Program can transfer tokens on behalf of users
- Automated operations possible
- Better UX (users don't sign every action)

### Problem 4: Account Ownership

**Without PDAs**: Accounts owned by users can be closed/deleted
- Users could withdraw funds unexpectedly
- No guarantee of account existence

**With PDAs**: Accounts owned by program persist
- Program controls account lifecycle
- Accounts can't be closed without program logic
- Guaranteed account existence

---

## Market PDA

### What It Is

The Market PDA is the **central configuration account** for each trading pair (e.g., SOL/USDC).

**File**: `dcex-program/programs/dcex/src/state/market.rs`

**Derivation Seeds**:
```rust
seeds = [
    MARKET_SEED,           // b"market"
    base_mint.as_ref(),    // Base token mint (e.g., SOL)
    quote_mint.as_ref(),   // Quote token mint (e.g., USDC)
]
```

**Address Example**:
```
Market PDA for SOL/USDC = findProgramAddress(
    [b"market", SOL_MINT, USDC_MINT],
    program_id
)
```

### What It Stores

```rust
pub struct Market {
    pub authority: Pubkey,              // Who can modify market settings
    pub base_mint: Pubkey,              // Base token mint (e.g., SOL)
    pub quote_mint: Pubkey,             // Quote token mint (e.g., USDC)
    pub base_vault: Pubkey,             // Escrow account for base tokens
    pub quote_vault: Pubkey,            // Escrow account for quote tokens
    pub base_decimals: u8,              // Base token decimals
    pub quote_decimals: u8,             // Quote token decimals
    pub min_order_size: u64,            // Minimum order size
    pub tick_size: u64,                 // Minimum price increment
    pub maker_fee_bps: u16,             // Maker fee (basis points)
    pub taker_fee_bps: u16,             // Taker fee (basis points)
    pub fee_recipient: Pubkey,          // Where fees go
    pub is_active: bool,                // Market status
    pub total_base_deposited: u64,      // Total deposits (tracking)
    pub total_quote_deposited: u64,     // Total deposits (tracking)
    pub bump: u8,                       // PDA bump seed
}
```

### Why Use Market PDA?

1. **Deterministic Market Discovery**:
   - Anyone can compute the Market PDA address from token mints
   - No need to store market addresses in a database
   - Same market pair always has the same address

2. **Single Source of Truth**:
   - All market configuration in one place
   - Can't have duplicate markets for same pair
   - Enforces uniqueness

3. **Program Control**:
   - Program owns the account
   - Only program can modify market settings
   - Authority can be changed by program logic

### How It's Used in Transactions

**File**: `dcex-program/programs/dcex/src/instructions/initialize_market.rs`

**Transaction: Initialize Market**

```rust
#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,  // User creating market

    #[account(
        init,                        // Create new account
        payer = authority,          // Authority pays rent
        space = Market::LEN,         // Account size
        seeds = [MARKET_SEED, base_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump                         // Anchor finds bump automatically
    )]
    pub market: Box<Account<'info, Market>>,  // Market PDA
    
    // ... other accounts
}
```

**What Happens**:
1. Anchor derives Market PDA from seeds
2. Creates account if it doesn't exist
3. Authority pays rent for account creation
4. Program initializes market data
5. Market PDA is now owned by program

**In Other Transactions**:

```rust
// In place_order, cancel_order, settle_trade, etc.
#[account(
    constraint = market.is_active @ DcexError::MarketNotActive
)]
pub market: Account<'info, Market>,  // Read market config
```

The Market PDA is passed as an account, and Anchor validates:
- Account exists
- Account is owned by program
- Account data matches Market struct
- Seeds match (if specified)

---

## Market Vaults (Escrow Accounts)

### What They Are

Market Vaults are **token accounts** that hold all user deposits in escrow. There are two vaults per market:
- **Base Vault**: Holds base tokens (e.g., SOL)
- **Quote Vault**: Holds quote tokens (e.g., USDC)

**File**: `dcex-program/programs/dcex/src/instructions/initialize_market.rs`

**Derivation Seeds**:
```rust
// Base Vault
seeds = [
    ESCROW_SEED,        // b"escrow"
    market.key().as_ref(),  // Market PDA address
    b"base",            // Literal "base" string
]

// Quote Vault
seeds = [
    ESCROW_SEED,        // b"escrow"
    market.key().as_ref(),  // Market PDA address
    b"quote",           // Literal "quote" string
]
```

### Why Use Market Vaults?

1. **Centralized Custody**:
   - All user funds in one place
   - Easier to manage and audit
   - Single escrow per token type

2. **Program Control**:
   - Market PDA is the authority of these token accounts
   - Program can transfer tokens without user signatures
   - Enables automated settlement

3. **Efficiency**:
   - Don't need to move tokens between users
   - Just update balances in User Vaults
   - Only move tokens on deposit/withdrawal

4. **Security**:
   - Funds are locked in program-controlled accounts
   - Can't be withdrawn without program logic
   - Transparent and auditable

### How They're Created

**File**: `dcex-program/programs/dcex/src/instructions/initialize_market.rs`

```rust
// Base Vault Creation
let base_seeds = &[
    ESCROW_SEED,
    market_key.as_ref(),
    b"base",
    &[base_vault_bump],  // Bump seed for signing
];
let base_signer = &[&base_seeds[..]];

// Step 1: Create account
anchor_lang::system_program::create_account(
    CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::CreateAccount {
            from: ctx.accounts.authority.to_account_info(),
            to: ctx.accounts.base_vault.to_account_info(),
        },
        base_signer,  // Market vault PDA signs account creation
    ),
    rent_lamports,
    TokenAccount::LEN as u64,
    &ctx.accounts.token_program.key(),
)?;

// Step 2: Initialize as token account
anchor_spl::token::initialize_account3(
    CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        anchor_spl::token::InitializeAccount3 {
            account: ctx.accounts.base_vault.to_account_info(),
            mint: ctx.accounts.base_mint.to_account_info(),
            authority: ctx.accounts.market.to_account_info(),  // Market PDA is authority
        },
    ),
)?;
```

**Key Points**:
1. Base Vault PDA signs its own creation (using seeds)
2. Market PDA is set as the token account authority
3. This means the Market PDA can transfer tokens from this account

### How They're Used in Transactions

#### 1. Deposit Transaction

**File**: `dcex-program/programs/dcex/src/instructions/deposit.rs`

```rust
// User deposits tokens INTO market vault
let cpi_accounts = Transfer {
    from: ctx.accounts.user_token_account.to_account_info(),  // User's account
    to: ctx.accounts.market_vault.to_account_info(),         // Market vault (escrow)
    authority: ctx.accounts.user.to_account_info(),          // User signs
};
token::transfer(cpi_ctx, params.amount)?;
```

**What Happens**:
- User transfers tokens from their account to Market Vault
- User signs the transfer (they own their token account)
- Tokens are now in escrow
- User Vault balance is updated (tracking, not actual tokens)

#### 2. Withdrawal Transaction

**File**: `dcex-program/programs/dcex/src/instructions/withdraw.rs`

```rust
// Market vault transfers tokens TO user
let seeds = &[
    MARKET_SEED,
    ctx.accounts.market.base_mint.as_ref(),
    ctx.accounts.market.quote_mint.as_ref(),
    &[ctx.accounts.market.bump],
];
let signer_seeds = &[&seeds[..]];

let cpi_accounts = Transfer {
    from: ctx.accounts.market_vault.to_account_info(),      // Market vault (escrow)
    to: ctx.accounts.user_token_account.to_account_info(),  // User's account
    authority: ctx.accounts.market.to_account_info(),       // Market PDA signs
};
let cpi_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    cpi_accounts,
    signer_seeds,  // Market PDA signs using seeds
);
token::transfer(cpi_ctx, params.amount)?;
```

**What Happens**:
- Market Vault transfers tokens to user
- **Market PDA signs** the transfer (not the user!)
- Program uses seeds to sign as Market PDA
- User Vault balance is decreased

**Why Market PDA Signs**:
- Market Vault is owned by Market PDA (it's the authority)
- Only the authority can transfer tokens from a token account
- Program provides seeds to "sign" as Market PDA

#### 3. Settlement Transaction (Fee Transfer)

**File**: `dcex-program/programs/dcex/src/instructions/settle_trade.rs`

```rust
// Transfer fees from market vault to fee recipient
if total_fees > 0 {
    let seeds = &[
        MARKET_SEED,
        ctx.accounts.market.base_mint.as_ref(),
        ctx.accounts.market.quote_mint.as_ref(),
        &[ctx.accounts.market.bump],
    ];
    let signer_seeds = &[&seeds[..]];
    
    let fee_cpi_accounts = Transfer {
        from: ctx.accounts.quote_vault.to_account_info(),  // Market vault
        to: ctx.accounts.fee_recipient.to_account_info(),  // Fee wallet
        authority: ctx.accounts.market.to_account_info(),  // Market PDA signs
    };
    let fee_cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        fee_cpi_accounts,
        signer_seeds,  // Market PDA signs
    );
    token::transfer(fee_cpi_ctx, total_fees)?;
}
```

**What Happens**:
- Fees are transferred from Market Vault to fee recipient
- Market PDA signs the transfer
- This happens automatically during settlement
- No user signature required

---

## User Vault PDA

### What It Is

The User Vault PDA is a **ledger account** that tracks a user's balances and locked funds for a specific market.

**File**: `dcex-program/programs/dcex/src/state/user_vault.rs`

**Derivation Seeds**:
```rust
seeds = [
    VAULT_SEED,        // b"vault"
    user.key().as_ref(),   // User's wallet address
    market.key().as_ref(), // Market PDA address
]
```

**Address Example**:
```
User Vault for Alice in SOL/USDC market = findProgramAddress(
    [b"vault", ALICE_WALLET, SOL_USDC_MARKET_PDA],
    program_id
)
```

### What It Stores

```rust
pub struct UserVault {
    pub user: Pubkey,                  // User's wallet address
    pub market: Pubkey,                 // Market PDA address
    pub base_balance: u64,             // Available base tokens
    pub quote_balance: u64,            // Available quote tokens
    pub base_locked: u64,               // Base tokens locked in orders
    pub quote_locked: u64,              // Quote tokens locked in orders
    pub total_base_deposited: u64,     // Lifetime deposits
    pub total_quote_deposited: u64,     // Lifetime deposits
    pub total_base_withdrawn: u64,     // Lifetime withdrawals
    pub total_quote_withdrawn: u64,     // Lifetime withdrawals
    pub bump: u8,                       // PDA bump seed
}
```

### Why Use User Vault PDA?

1. **Efficiency**:
   - Don't need to move tokens for every trade
   - Just update balances in User Vault
   - Only move tokens on deposit/withdrawal

2. **Order Locking**:
   - Can lock funds for orders without transfers
   - `base_locked` and `quote_locked` track locked amounts
   - Prevents double-spending

3. **Deterministic Lookup**:
   - Can compute User Vault address from user + market
   - No need to store addresses
   - Same user + market always has same vault

4. **Per-Market Isolation**:
   - Each market has separate User Vault
   - Balances are market-specific
   - Can't accidentally use wrong market's funds

### How It's Used in Transactions

#### 1. Deposit Transaction

**File**: `dcex-program/programs/dcex/src/instructions/deposit.rs`

```rust
#[account(
    init_if_needed,  // Create if doesn't exist
    payer = user,     // User pays rent
    space = UserVault::LEN,
    seeds = [VAULT_SEED, user.key().as_ref(), market.key().as_ref()],
    bump
)]
pub user_vault: Account<'info, UserVault>,

// After token transfer to market vault:
if params.is_base {
    user_vault.base_balance += params.amount;
    user_vault.total_base_deposited += params.amount;
} else {
    user_vault.quote_balance += params.amount;
    user_vault.total_quote_deposited += params.amount;
}
```

**What Happens**:
1. User Vault PDA is derived/created
2. Tokens transferred to Market Vault (physical movement)
3. User Vault balance increased (ledger update)
4. No tokens in User Vault - it's just a ledger!

#### 2. Place Order Transaction

**File**: `dcex-program/programs/dcex/src/instructions/place_order.rs`

```rust
#[account(
    mut,
    seeds = [VAULT_SEED, user.key().as_ref(), market.key().as_ref()],
    bump = user_vault.bump,
    constraint = user_vault.user == user.key() @ DcexError::Unauthorized
)]
pub user_vault: Account<'info, UserVault>,

// Lock funds for order
match params.side {
    OrderSide::Buy => {
        user_vault.lock_quote(quote_amount)?;  // Locks quote tokens
    }
    OrderSide::Sell => {
        user_vault.lock_base(params.size)?;   // Locks base tokens
    }
}
```

**What Happens**:
1. User Vault PDA is loaded
2. Funds are locked (no token transfer!)
3. `base_locked` or `quote_locked` increased
4. Tokens remain in Market Vault
5. User Vault just tracks that funds are locked

**Locking Logic**:
```rust
pub fn lock_base(&mut self, amount: u64) -> Result<()> {
    require!(
        self.available_base() >= amount,  // available = balance - locked
        DcexError::InsufficientBalance
    );
    self.base_locked += amount;
    Ok(())
}
```

#### 3. Settlement Transaction

**File**: `dcex-program/programs/dcex/src/instructions/settle_trade.rs`

```rust
// Maker Vault
#[account(
    mut,
    seeds = [VAULT_SEED, maker_order.user.as_ref(), market.key().as_ref()],
    bump = maker_vault.bump
)]
pub maker_vault: Account<'info, UserVault>,

// Taker Vault
#[account(
    mut,
    seeds = [VAULT_SEED, taker_order.user.as_ref(), market.key().as_ref()],
    bump = taker_vault.bump
)]
pub taker_vault: Account<'info, UserVault>,

// Example: Maker sells, Taker buys
match maker_order.side {
    OrderSide::Sell => {
        // Maker: unlock base, decrease base_balance, increase quote_balance
        maker_vault.unlock_base(base_amount)?;
        maker_vault.base_balance -= base_amount;
        let maker_quote_received = quote_amount - maker_fee;
        maker_vault.quote_balance += maker_quote_received;
        
        // Taker: unlock quote, decrease quote_balance, increase base_balance
        taker_vault.unlock_quote(quote_amount)?;
        let taker_quote_paid = quote_amount + taker_fee;
        taker_vault.quote_balance -= taker_quote_paid;
        taker_vault.base_balance += base_amount;
    }
    // ... similar for Buy side
}
```

**What Happens**:
1. Both User Vaults are loaded
2. Locked funds are unlocked
3. Balances are updated (no token transfers!)
4. Tokens remain in Market Vault
5. User Vaults track the new balances

**Key Point**: No token transfers happen during settlement! Only User Vault balances change. Tokens stay in Market Vault.

#### 4. Cancel Order Transaction

**File**: `dcex-program/programs/dcex/src/instructions/cancel_order.rs`

```rust
let remaining = order.remaining();
let quote_amount = remaining * order.price / 10^base_decimals;

match order.side {
    OrderSide::Buy => {
        user_vault.unlock_quote(quote_amount)?;  // Unlocks quote
    }
    OrderSide::Sell => {
        user_vault.unlock_base(remaining)?;       // Unlocks base
    }
}
```

**What Happens**:
1. User Vault is loaded
2. Locked funds are unlocked
3. Balance becomes available again
4. No token transfers needed

---

## Order PDA

### What It Is

The Order PDA is an **on-chain order record** that stores order details and tracks fills.

**File**: `dcex-program/programs/dcex/src/state/order.rs`

**Derivation Seeds**:
```rust
seeds = [
    ORDER_SEED,                    // b"order"
    params.order_id.to_le_bytes().as_ref(),  // Order ID (u128)
]
```

**Address Example**:
```
Order PDA for order_id 12345 = findProgramAddress(
    [b"order", 12345_u128.to_le_bytes()],
    program_id
)
```

### What It Stores

```rust
pub struct Order {
    pub user: Pubkey,              // User who placed order
    pub market: Pubkey,             // Market PDA address
    pub order_id: u128,             // Unique order ID
    pub side: OrderSide,            // Buy or Sell
    pub price: u64,                 // Order price
    pub size: u64,                  // Order size
    pub filled: u64,                // Amount filled so far
    pub status: OrderStatus,         // Pending, PartiallyFilled, Filled, Cancelled
    pub created_at: i64,             // Timestamp
    pub updated_at: i64,             // Last update timestamp
    pub bump: u8,                   // PDA bump seed
}
```

### Why Use Order PDA?

1. **On-Chain Order Record**:
   - Immutable order history
   - Can verify orders on-chain
   - Transparent order tracking

2. **Deterministic Lookup**:
   - Can compute Order PDA from order_id
   - No need to store order addresses
   - Same order_id always has same address

3. **Program Control**:
   - Program owns order account
   - Only program can modify order
   - Prevents order tampering

4. **Settlement Reference**:
   - Settlement can reference orders by PDA
   - Validates order exists and is active
   - Tracks fills on-chain

### How It's Used in Transactions

#### 1. Place Order Transaction

**File**: `dcex-program/programs/dcex/src/instructions/place_order.rs`

```rust
#[account(
    init,                        // Create new order account
    payer = user,                // User pays rent
    space = Order::LEN,
    seeds = [ORDER_SEED, params.order_id.to_le_bytes().as_ref()],
    bump
)]
pub order: Account<'info, Order>,

// Initialize order
order.user = ctx.accounts.user.key();
order.market = ctx.accounts.market.key();
order.order_id = params.order_id;
order.side = params.side;
order.price = params.price;
order.size = params.size;
order.filled = 0;
order.status = OrderStatus::Pending;
order.created_at = clock.unix_timestamp;
order.updated_at = clock.unix_timestamp;
order.bump = ctx.bumps.order;
```

**What Happens**:
1. Order PDA is created from order_id
2. Order data is stored in account
3. User pays rent for account creation
4. Order is now on-chain and immutable

#### 2. Settlement Transaction

**File**: `dcex-program/programs/dcex/src/instructions/settle_trade.rs`

```rust
// Maker Order
#[account(
    mut,
    seeds = [ORDER_SEED, maker_order.order_id.to_le_bytes().as_ref()],
    bump = maker_order.bump
)]
pub maker_order: Account<'info, Order>,

// Taker Order
#[account(
    mut,
    seeds = [ORDER_SEED, taker_order.order_id.to_le_bytes().as_ref()],
    bump = taker_order.bump
)]
pub taker_order: Account<'info, Order>,

// Validate orders
require!(maker_order.is_active(), DcexError::InvalidOrderStatus);
require!(taker_order.is_active(), DcexError::InvalidOrderStatus);
require!(maker_order.remaining() >= fill_size, DcexError::SettlementAmountMismatch);
require!(taker_order.remaining() >= fill_size, DcexError::SettlementAmountMismatch);

// Update fills
maker_order.fill(fill_size)?;
taker_order.fill(fill_size)?;
```

**What Happens**:
1. Both Order PDAs are loaded
2. Orders are validated (active, sufficient remaining)
3. Fills are updated on both orders
4. Order status may change (PartiallyFilled → Filled)

**Fill Logic**:
```rust
pub fn fill(&mut self, amount: u64) -> Result<()> {
    self.filled += amount;
    
    if self.filled >= self.size {
        self.status = OrderStatus::Filled;
    } else if self.filled > 0 {
        self.status = OrderStatus::PartiallyFilled;
    }
    
    self.updated_at = Clock::get()?.unix_timestamp;
    Ok(())
}
```

#### 3. Cancel Order Transaction

**File**: `dcex-program/programs/dcex/src/instructions/cancel_order.rs`

```rust
#[account(
    mut,
    seeds = [ORDER_SEED, order.order_id.to_le_bytes().as_ref()],
    bump = order.bump,
    constraint = order.user == user.key() @ DcexError::Unauthorized,
    constraint = order.market == market.key() @ DcexError::InvalidMarketConfiguration
)]
pub order: Account<'info, Order>,

// Cancel order
require!(order.is_active(), DcexError::InvalidOrderStatus);
order.cancel()?;
```

**What Happens**:
1. Order PDA is loaded
2. Validates user owns order
3. Validates order is active
4. Sets status to Cancelled

---

## PDA Signing in Transactions

### How Programs Sign as PDAs

When a program needs to sign a transaction as a PDA, it provides the **seeds** and **bump** to Solana. Solana then:
1. Re-derives the PDA from seeds
2. Verifies the PDA matches the account
3. Allows the program to sign as that PDA

### Example: Market PDA Signing

**File**: `dcex-program/programs/dcex/src/instructions/withdraw.rs`

```rust
// Prepare seeds for Market PDA
let seeds = &[
    MARKET_SEED,                                    // b"market"
    ctx.accounts.market.base_mint.as_ref(),         // Base mint
    ctx.accounts.market.quote_mint.as_ref(),        // Quote mint
    &[ctx.accounts.market.bump],                    // Bump seed
];
let signer_seeds = &[&seeds[..]];

// Transfer tokens FROM market vault TO user
let cpi_accounts = Transfer {
    from: ctx.accounts.market_vault.to_account_info(),      // Source: Market Vault
    to: ctx.accounts.user_token_account.to_account_info(),  // Destination: User
    authority: ctx.accounts.market.to_account_info(),         // Market PDA is authority
};
let cpi_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    cpi_accounts,
    signer_seeds,  // Program signs as Market PDA using seeds
);
token::transfer(cpi_ctx, params.amount)?;
```

**Step-by-Step**:
1. Program prepares seeds: `[MARKET_SEED, base_mint, quote_mint, bump]`
2. Program calls `CpiContext::new_with_signer()` with seeds
3. Anchor/Solana runtime:
   - Re-derives Market PDA from seeds
   - Verifies Market PDA matches `market` account
   - Uses Market PDA as signer for the CPI call
4. Token Program receives transfer request
5. Token Program verifies Market PDA is authority of Market Vault
6. Transfer executes

### Why This Works

- **Market Vault** was created with Market PDA as authority
- Only the authority can transfer tokens from a token account
- Program provides seeds to "prove" it controls Market PDA
- Solana runtime verifies seeds → PDA → authority match
- Transfer is authorized

### Security Guarantees

1. **Only Program Can Sign**: Only the program that owns the PDA can provide valid seeds
2. **Deterministic**: Same seeds always produce same PDA
3. **Verifiable**: Anyone can verify the PDA derivation
4. **Immutable**: Seeds can't be changed after account creation

---

## Complete Transaction Examples

### Example 1: User Deposits SOL

**Transaction Structure**:
```
Instruction: deposit
Accounts:
  - user (signer) ✅
  - market (Market PDA) - read
  - user_vault (User Vault PDA) - init_if_needed, write
  - user_token_account (user's SOL account) - read
  - market_vault (Market Base Vault PDA) - write
  - token_program - read
  - system_program - read
```

**Step-by-Step**:
1. **Derive Accounts**:
   - Market PDA: `[MARKET_SEED, SOL_MINT, USDC_MINT]`
   - User Vault PDA: `[VAULT_SEED, USER, MARKET_PDA]`
   - Market Vault PDA: `[ESCROW_SEED, MARKET_PDA, b"base"]`

2. **Validate**:
   - Market is active
   - User token account belongs to user
   - User token account mint matches market base_mint
   - Market vault matches market.base_vault

3. **Create User Vault** (if needed):
   - User pays rent
   - Initialize with user, market, zero balances

4. **Transfer Tokens**:
   - CPI: `token::transfer`
   - From: user_token_account (user signs)
   - To: market_vault
   - Amount: params.amount

5. **Update User Vault**:
   - `user_vault.base_balance += amount`
   - `user_vault.total_base_deposited += amount`

**Result**:
- SOL tokens moved from user to Market Vault (physical)
- User Vault balance increased (ledger)
- User can now place orders

### Example 2: User Places Buy Order

**Transaction Structure**:
```
Instruction: place_order
Accounts:
  - user (signer) ✅
  - market (Market PDA) - read
  - user_vault (User Vault PDA) - write
  - order (Order PDA) - init, write
  - system_program - read
```

**Step-by-Step**:
1. **Derive Accounts**:
   - Market PDA: `[MARKET_SEED, SOL_MINT, USDC_MINT]`
   - User Vault PDA: `[VAULT_SEED, USER, MARKET_PDA]`
   - Order PDA: `[ORDER_SEED, order_id.to_le_bytes()]`

2. **Validate**:
   - Market is active
   - Order size >= min_order_size
   - Price aligned to tick_size

3. **Calculate Quote Amount**:
   - `quote_amount = size * price / 10^base_decimals`

4. **Lock Funds**:
   - `user_vault.lock_quote(quote_amount)`
   - Increases `user_vault.quote_locked`
   - No token transfer!

5. **Create Order PDA**:
   - User pays rent
   - Initialize order with all fields
   - Status: Pending

**Result**:
- Order PDA created on-chain
- Funds locked in User Vault (ledger only)
- Tokens still in Market Vault
- Order can now be matched off-chain

### Example 3: Settlement (Maker Sells, Taker Buys)

**Transaction Structure**:
```
Instruction: settle_trade
Accounts:
  - authority (signer) ✅ - Settlement service
  - market (Market PDA) - read
  - maker_vault (User Vault PDA) - write
  - taker_vault (User Vault PDA) - write
  - maker_order (Order PDA) - write
  - taker_order (Order PDA) - write
  - base_vault (Market Base Vault PDA) - read
  - quote_vault (Market Quote Vault PDA) - write
  - fee_recipient (Token Account) - write
  - token_program - read
```

**Step-by-Step**:
1. **Derive Accounts**:
   - Market PDA: `[MARKET_SEED, SOL_MINT, USDC_MINT]`
   - Maker Vault PDA: `[VAULT_SEED, MAKER, MARKET_PDA]`
   - Taker Vault PDA: `[VAULT_SEED, TAKER, MARKET_PDA]`
   - Maker Order PDA: `[ORDER_SEED, maker_order_id.to_le_bytes()]`
   - Taker Order PDA: `[ORDER_SEED, taker_order_id.to_le_bytes()]`
   - Base Vault PDA: `[ESCROW_SEED, MARKET_PDA, b"base"]`
   - Quote Vault PDA: `[ESCROW_SEED, MARKET_PDA, b"quote"]`

2. **Validate**:
   - Market is active
   - Authority matches market.authority
   - Both orders are active
   - Both orders have sufficient remaining

3. **Calculate Amounts**:
   - `base_amount = fill_size`
   - `quote_amount = fill_size * fill_price / 10^base_decimals`
   - `maker_fee = quote_amount * maker_fee_bps / 10000`
   - `taker_fee = quote_amount * taker_fee_bps / 10000`

4. **Update Maker Vault** (Seller):
   - `maker_vault.unlock_base(base_amount)` - Unlock locked base
   - `maker_vault.base_balance -= base_amount` - Decrease base balance
   - `maker_vault.quote_balance += (quote_amount - maker_fee)` - Increase quote balance

5. **Update Taker Vault** (Buyer):
   - `taker_vault.unlock_quote(quote_amount)` - Unlock locked quote
   - `taker_vault.quote_balance -= (quote_amount + taker_fee)` - Decrease quote balance
   - `taker_vault.base_balance += base_amount` - Increase base balance

6. **Transfer Fees** (if > 0):
   - Prepare Market PDA seeds
   - CPI: `token::transfer`
   - From: quote_vault (Market PDA signs)
   - To: fee_recipient
   - Amount: total_fees

7. **Update Orders**:
   - `maker_order.fill(fill_size)`
   - `taker_order.fill(fill_size)`

**Result**:
- Maker Vault: base decreased, quote increased (minus fee)
- Taker Vault: quote decreased (plus fee), base increased
- Fees transferred to fee recipient
- Orders updated with fills
- **No token transfers between users!** All tokens stay in Market Vault

### Example 4: User Withdraws SOL

**Transaction Structure**:
```
Instruction: withdraw
Accounts:
  - user (signer) ✅
  - market (Market PDA) - read
  - user_vault (User Vault PDA) - write
  - user_token_account (user's SOL account) - write
  - market_vault (Market Base Vault PDA) - write
  - token_program - read
```

**Step-by-Step**:
1. **Derive Accounts**:
   - Market PDA: `[MARKET_SEED, SOL_MINT, USDC_MINT]`
   - User Vault PDA: `[VAULT_SEED, USER, MARKET_PDA]`
   - Market Vault PDA: `[ESCROW_SEED, MARKET_PDA, b"base"]`

2. **Validate**:
   - Market is active
   - User token account belongs to user
   - User token account mint matches market base_mint
   - Market vault matches market.base_vault

3. **Check Balance**:
   - `require!(user_vault.available_base() >= amount)`
   - `available_base = base_balance - base_locked`

4. **Update User Vault**:
   - `user_vault.base_balance -= amount`
   - `user_vault.total_base_withdrawn += amount`

5. **Transfer Tokens**:
   - Prepare Market PDA seeds
   - CPI: `token::transfer`
   - From: market_vault (Market PDA signs)
   - To: user_token_account
   - Amount: params.amount

**Result**:
- SOL tokens moved from Market Vault to user (physical)
- User Vault balance decreased (ledger)
- User now has SOL in their wallet

---

## Summary: Why Each PDA Exists

| PDA | Purpose | Why PDA? | Key Benefit |
|-----|---------|----------|-------------|
| **Market PDA** | Market configuration | Deterministic lookup, program control | Same market pair = same address |
| **Market Vaults** | Escrow for all tokens | Program-controlled custody | Secure, centralized escrow |
| **User Vault** | Balance ledger per user/market | Efficient, deterministic | No token transfers for trades |
| **Order PDA** | On-chain order record | Immutable, verifiable | Transparent order history |

### Key Design Principles

1. **Deterministic**: All PDAs can be computed from known seeds
2. **Program Control**: Program owns and controls all PDAs
3. **Efficiency**: Minimize token transfers (only deposit/withdrawal)
4. **Security**: Funds locked in program-controlled escrow
5. **Transparency**: All state on-chain, verifiable

### Token Flow Summary

```
User Wallet
    ↓ (deposit)
Market Vault (escrow) ← All tokens stored here
    ↑ (withdrawal)
User Wallet

User Vault (ledger) ← Tracks balances, no tokens stored
    ↑ ↓ (balance updates)
Order PDA ← Tracks order state
```

**Key Insight**: Tokens are **physically** in Market Vault. User Vaults are just **ledgers** tracking balances. Orders are **records** tracking order state. This design minimizes on-chain token transfers while maintaining security and transparency.
