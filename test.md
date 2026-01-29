# DCEX End-to-End Testing Guide

This guide covers complete testing of the DCEX system from deployment to all API endpoints and trading flows.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Solana Program Deployment](#solana-program-deployment)
4. [Matching Engine Setup](#matching-engine-setup)
5. [Frontend Setup](#frontend-setup)
6. [API Testing](#api-testing)
7. [Trading Flow Testing](#trading-flow-testing)
8. [On-Chain Operations Testing](#on-chain-operations-testing)
9. [End-to-End Scenarios](#end-to-end-scenarios)

---

## Prerequisites

### Required Software

- **Docker & Docker Compose** - For Postgres and Redis
- **Rust** (latest stable) - For matching engine and Solana program
- **Solana CLI** (v1.18+) - For localnet and program deployment
- **Anchor** (v0.29+) - For Solana program development
- **Bun** (v1.0+) - For frontend package management
- **Node.js** (v18+) - For frontend runtime
- **jq** - For JSON parsing in tests (optional but recommended)

### Verify Installations

```bash
# Check Docker
docker --version
docker-compose --version

# Check Rust
rustc --version
cargo --version

# Check Solana
solana --version

# Check Anchor
anchor --version

# Check Bun
bun --version

# Check jq (optional)
jq --version
```

---

## Infrastructure Setup

### 1. Start Docker Services

Start Postgres and Redis using Docker Compose:

```bash
cd /path/to/dcex
docker-compose up -d
```

Verify services are running:

```bash
docker-compose ps
```

Expected output:
```
NAME            STATUS
dcex-postgres   Up (healthy)
dcex-redis      Up (healthy)
```

### 2. Start Solana Localnet

Start a Solana test validator:

```bash
# Kill any existing validator
pkill solana-test-validator

# Start fresh validator
COPYFILE_DISABLE=1 solana-test-validator --reset

# In another terminal, verify it's running
solana config get
curl -X POST http://localhost:8899 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

Expected response: `{"jsonrpc":"2.0","result":"ok","id":1}`

### 3. Configure Solana CLI

Ensure Solana CLI is configured for localnet:

```bash
solana config set --url localhost
solana config get
```

Expected output:
```
Config File: ~/.config/solana/cli/config.yml
RPC URL: http://localhost:8899
```

### 4. Fund Test Wallet

Ensure your default wallet has SOL for transactions:

```bash
solana balance
# If balance is 0 or low:
solana airdrop 10
```

---

## Solana Program Deployment

### 1. Build the Program

```bash
cd dcex-program
anchor build
```

**Note:** You may see a stack overflow warning during build. This is a known issue with Anchor when there are many accounts. The build should still complete successfully.

### 2. Get Program ID

```bash
# Check the program ID from keypair
solana-keygen pubkey target/deploy/dcex-keypair.json

# Expected: Should match Anchor.toml or note the actual deployed ID
```

### 3. Deploy the Program

```bash
# Deploy using the keypair
solana program deploy --program-id target/deploy/dcex-keypair.json target/deploy/dcex.so
```

Expected output:
```
Program Id: <program-id>
Signature: <transaction-signature>
```

### 4. Verify Deployment

```bash
# Replace <program-id> with actual program ID
solana program show <program-id>
```

Expected output should show:
- Program Id
- Owner: BPFLoaderUpgradeab1e11111111111111111111111
- Data Length: ~380KB
- Balance: ~2.6 SOL

### 5. Update Environment Files

**Important:** If the deployed program ID doesn't match the expected ID in config files, update them:

```bash
# Get actual deployed program ID
DEPLOYED_PROGRAM_ID=$(solana-keygen pubkey dcex-program/target/deploy/dcex-keypair.json)

# Update matching-engine/.env
echo "PROGRAM_ID=$DEPLOYED_PROGRAM_ID" >> matching-engine/.env

# Update dcex-frontend/.env.local
echo "NEXT_PUBLIC_PROGRAM_ID=$DEPLOYED_PROGRAM_ID" >> dcex-frontend/.env.local
```

---

## Matching Engine Setup

### 1. Configure Environment

```bash
cd matching-engine
cp .env.example .env
```

Edit `.env` and ensure:
```env
SERVER_ADDR=0.0.0.0:3001
DATABASE_URL=postgres://postgres:password@localhost:5432/dcex
REDIS_URL=redis://127.0.0.1:6379
SOLANA_RPC_URL=http://localhost:8899
PROGRAM_ID=<your-deployed-program-id>
RUST_LOG=matching_engine=debug,tower_http=debug
```

### 2. Run Database Migrations

```bash
# Install sqlx CLI if not already installed
cargo install sqlx-cli --features postgres

# Run migrations
sqlx migrate run
```

Expected output:
```
Applied migration: 001_create_markets
Applied migration: 002_create_orders
Applied migration: 003_create_trades
Applied migration: 004_seed_market
```

### 3. Verify Database

```bash
# Connect to Postgres
docker exec -it dcex-postgres psql -U postgres -d dcex

# Check markets table
SELECT * FROM markets;

# Exit
\q
```

### 4. Start Matching Engine

```bash
cd matching-engine
cargo run
```

Expected output:
```
Server running on http://0.0.0.0:3001
```

### 5. Verify Matching Engine Health

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"healthy","version":"0.1.0"}
```

---

## Frontend Setup

### 1. Configure Environment

```bash
cd dcex-frontend
cp .env.local.example .env.local
```

Edit `.env.local` and ensure:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899
NEXT_PUBLIC_PROGRAM_ID=<your-deployed-program-id>
```

### 2. Install Dependencies

```bash
cd dcex-frontend
bun install
```

### 3. Start Development Server

```bash
bun dev
```

Expected output:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
```

### 4. Verify Frontend

Open browser: http://localhost:3000

You should see the DCEX trading interface redirecting to `/market/SOL-USDC`.

---

## API Testing

### Test Variables

Set these variables for testing:

```bash
# Market ID (from seed migration)
MARKET_ID="00000000-0000-0000-0000-000000000001"

# Test wallet addresses
WALLET1="3ZUZyK1LLVa8diRih4vr2D9VTyusnjikWnqD2KhW9MV7"  # Your Solana wallet
WALLET2="11111111111111111111111111111111"  # Test wallet

# Base URL
API_URL="http://localhost:3001"
```

### 1. Health Check

```bash
curl $API_URL/health | jq .
```

Expected:
```json
{
  "status": "healthy",
  "version": "0.1.0"
}
```

### 2. Get Markets

```bash
curl $API_URL/api/markets | jq .
```

Expected:
```json
[
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "base_mint": "So11111111111111111111111111111111111111112",
    "quote_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "base_decimals": 9,
    "quote_decimals": 6,
    "min_order_size": 1000000,
    "tick_size": 1000000,
    "maker_fee_bps": 5,
    "taker_fee_bps": 10,
    "is_active": true,
    "created_at": "2026-01-27T16:07:40.415355Z"
  }
]
```

### 3. Get Market Details

```bash
curl "$API_URL/api/markets/$MARKET_ID" | jq .
```

### 4. Get Orderbook

```bash
curl "$API_URL/api/markets/$MARKET_ID/orderbook" | jq .
```

Expected (empty initially):
```json
{
  "market_id": "00000000-0000-0000-0000-000000000001",
  "bids": [],
  "asks": [],
  "last_price": null,
  "timestamp": "2026-01-28T..."
}
```

### 5. Get Trade History

```bash
curl "$API_URL/api/markets/$MARKET_ID/trades" | jq .
```

Expected (empty initially):
```json
[]
```

### 6. Place Buy Order

```bash
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"buy\",
    \"price\": 100000000,
    \"size\": 10000000,
    \"wallet\": \"$WALLET1\",
    \"signature\": \"test-sig-1\"
  }" | jq .
```

Expected response:
```json
{
  "order": {
    "id": 1,
    "order_id": 1769608665134084000,
    "user_wallet": "3ZUZyK1LLVa8diRih4vr2D9VTyusnjikWnqD2KhW9MV7",
    "market_id": "00000000-0000-0000-0000-000000000001",
    "side": "buy",
    "price": 100000000,
    "size": 10000000,
    "filled": 0,
    "status": "pending",
    "on_chain_signature": null,
    "created_at": "2026-01-28T...",
    "updated_at": "2026-01-28T..."
  },
  "trades": []
}
```

### 7. Place Sell Order (Matching)

```bash
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"sell\",
    \"price\": 100000000,
    \"size\": 5000000,
    \"wallet\": \"$WALLET2\",
    \"signature\": \"test-sig-2\"
  }" | jq .
```

Expected response (with immediate match):
```json
{
  "order": {
    "id": 2,
    "order_id": 1769608668575664000,
    "user_wallet": "11111111111111111111111111111111",
    "market_id": "00000000-0000-0000-0000-000000000001",
    "side": "sell",
    "price": 100000000,
    "size": 5000000,
    "filled": 5000000,
    "status": "filled",
    ...
  },
  "trades": [
    {
      "maker_order_id": 1769608665134084000,
      "price": 100000000,
      "size": 5000000
    }
  ]
}
```

### 8. Verify Orderbook After Trade

```bash
curl "$API_URL/api/markets/$MARKET_ID/orderbook" | jq .
```

Expected (showing remaining buy order):
```json
{
  "market_id": "00000000-0000-0000-0000-000000000001",
  "bids": [
    {
      "price": 100000000,
      "size": 5000000,
      "order_count": 1
    }
  ],
  "asks": [],
  "last_price": 100000000,
  "timestamp": "2026-01-28T..."
}
```

### 9. Verify Trade History

```bash
curl "$API_URL/api/markets/$MARKET_ID/trades" | jq .
```

Expected:
```json
[
  {
    "id": 1,
    "market_id": "00000000-0000-0000-0000-000000000001",
    "maker_order_id": 1769608665134084000,
    "taker_order_id": 1769608668575664000,
    "maker_wallet": "3ZUZyK1LLVa8diRih4vr2D9VTyusnjikWnqD2KhW9MV7",
    "taker_wallet": "11111111111111111111111111111111",
    "price": 100000000,
    "size": 5000000,
    "maker_fee": 250,
    "taker_fee": 500,
    "settlement_signature": null,
    "created_at": "2026-01-28T..."
  }
]
```

### 10. Get User Orders

```bash
curl "$API_URL/api/users/$WALLET1/orders" | jq .
```

Expected:
```json
[
  {
    "id": 1,
    "order_id": 1769608665134084000,
    "user_wallet": "3ZUZyK1LLVa8diRih4vr2D9VTyusnjikWnqD2KhW9MV7",
    "market_id": "00000000-0000-0000-0000-000000000001",
    "side": "buy",
    "price": 100000000,
    "size": 10000000,
    "filled": 5000000,
    "status": "partiallyfilled",
    ...
  }
]
```

### 11. Get Single Order

```bash
# Replace ORDER_ID with actual order_id from previous response
ORDER_ID=1769608665134084000
curl "$API_URL/api/orders/$ORDER_ID" | jq .
```

### 12. Cancel Order

```bash
ORDER_ID=1769608665134084000
curl -X DELETE "$API_URL/api/orders/$ORDER_ID" | jq .
```

Expected:
```json
{
  "id": 1,
  "order_id": 1769608665134084000,
  "status": "cancelled",
  ...
}
```

### 13. Verify Orderbook After Cancellation

```bash
curl "$API_URL/api/markets/$MARKET_ID/orderbook" | jq .
```

Expected (empty orderbook):
```json
{
  "market_id": "00000000-0000-0000-0000-000000000001",
  "bids": [],
  "asks": [],
  "last_price": 100000000,
  "timestamp": "2026-01-28T..."
}
```

---

## Trading Flow Testing

### Scenario 1: Simple Match

**Objective:** Test immediate order matching

1. Place a buy order:
```bash
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"buy\",
    \"price\": 100000000,
    \"size\": 10000000,
    \"wallet\": \"$WALLET1\",
    \"signature\": \"test-sig-buy-1\"
  }" | jq .
```

2. Place a matching sell order:
```bash
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"sell\",
    \"price\": 100000000,
    \"size\": 10000000,
    \"wallet\": \"$WALLET2\",
    \"signature\": \"test-sig-sell-1\"
  }" | jq .
```

**Expected:** Both orders should fill completely, trade recorded, orderbook empty.

### Scenario 2: Partial Fill

**Objective:** Test partial order matching

1. Place a large buy order:
```bash
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"buy\",
    \"price\": 100000000,
    \"size\": 20000000,
    \"wallet\": \"$WALLET1\",
    \"signature\": \"test-sig-buy-2\"
  }" | jq .
```

2. Place a smaller sell order:
```bash
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"sell\",
    \"price\": 100000000,
    \"size\": 5000000,
    \"wallet\": \"$WALLET2\",
    \"signature\": \"test-sig-sell-2\"
  }" | jq .
```

**Expected:** 
- Sell order fills completely
- Buy order partially fills (5M filled, 15M remaining)
- Remaining buy order stays in orderbook

### Scenario 3: Price-Time Priority

**Objective:** Test that better prices match first

1. Place multiple buy orders at different prices:
```bash
# Buy at 95M
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"buy\",
    \"price\": 95000000,
    \"size\": 10000000,
    \"wallet\": \"$WALLET1\",
    \"signature\": \"test-sig-buy-3a\"
  }" | jq .

# Buy at 100M
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"buy\",
    \"price\": 100000000,
    \"size\": 10000000,
    \"wallet\": \"$WALLET1\",
    \"signature\": \"test-sig-buy-3b\"
  }" | jq .
```

2. Place a sell order at 95M:
```bash
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"sell\",
    \"price\": 95000000,
    \"size\": 5000000,
    \"wallet\": \"$WALLET2\",
    \"signature\": \"test-sig-sell-3\"
  }" | jq .
```

**Expected:** Sell order matches with the 100M buy order (better price for seller).

### Scenario 4: Order Cancellation

**Objective:** Test order cancellation flow

1. Place an order:
```bash
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"buy\",
    \"price\": 100000000,
    \"size\": 10000000,
    \"wallet\": \"$WALLET1\",
    \"signature\": \"test-sig-buy-4\"
  }" | jq .
```

2. Verify orderbook has the order:
```bash
curl "$API_URL/api/markets/$MARKET_ID/orderbook" | jq .
```

3. Cancel the order:
```bash
# Get order_id from step 1 response
ORDER_ID=<order_id>
curl -X DELETE "$API_URL/api/orders/$ORDER_ID" | jq .
```

4. Verify orderbook is empty:
```bash
curl "$API_URL/api/markets/$MARKET_ID/orderbook" | jq .
```

**Expected:** Order removed from orderbook, status changed to "cancelled".

### Scenario 5: Multiple Orders and Matching

**Objective:** Test complex orderbook state

1. Place multiple orders:
```bash
# Buy orders
curl -X POST $API_URL/api/orders -H "Content-Type: application/json" -d '{"market_id":"'$MARKET_ID'","side":"buy","price":95000000,"size":10000000,"wallet":"'$WALLET1'","signature":"buy-1"}' | jq .
curl -X POST $API_URL/api/orders -H "Content-Type: application/json" -d '{"market_id":"'$MARKET_ID'","side":"buy","price":100000000,"size":10000000,"wallet":"'$WALLET1'","signature":"buy-2"}' | jq .

# Sell orders
curl -X POST $API_URL/api/orders -H "Content-Type: application/json" -d '{"market_id":"'$MARKET_ID'","side":"sell","price":105000000,"size":10000000,"wallet":"'$WALLET2'","signature":"sell-1"}' | jq .
curl -X POST $API_URL/api/orders -H "Content-Type: application/json" -d '{"market_id":"'$MARKET_ID'","side":"sell","price":110000000,"size":10000000,"wallet":"'$WALLET2'","signature":"sell-2"}' | jq .
```

2. Check orderbook:
```bash
curl "$API_URL/api/markets/$MARKET_ID/orderbook" | jq .
```

**Expected:** 
- Bids: [100M, 95M] (sorted descending)
- Asks: [105M, 110M] (sorted ascending)

3. Place a market order (sell at 95M to match best bid):
```bash
curl -X POST $API_URL/api/orders -H "Content-Type: application/json" -d '{"market_id":"'$MARKET_ID'","side":"sell","price":95000000,"size":5000000,"wallet":"'$WALLET2'","signature":"sell-market"}' | jq .
```

**Expected:** Matches with 100M buy order (best price).

---

## On-Chain Operations Testing

### Prerequisites

For on-chain testing, you need:
1. Program deployed and program ID configured correctly
2. Test tokens (SOL and USDC) minted
3. User vaults initialized

### 1. Initialize Market (On-Chain)

**Note:** This requires creating token mints and calling the initialize_market instruction.

```bash
# This would typically be done via a script or Anchor test
# Example structure:

# 1. Create base mint (SOL)
# 2. Create quote mint (USDC)
# 3. Call initialize_market instruction with:
#    - min_order_size: 1000000
#    - tick_size: 1000000
#    - maker_fee_bps: 5
#    - taker_fee_bps: 10
```

### 2. Deposit Funds

**Test deposit flow:**

```bash
# Deposit base token (SOL)
# This would call the deposit instruction on-chain
# Requires:
# - User wallet (signer)
# - Market PDA
# - User vault PDA
# - Token account with funds
# - Amount to deposit
```

**Verify deposit:**
- Check user vault balance on-chain
- Verify funds locked in vault

### 3. Place Order (On-Chain)

**Test placing order on-chain:**

```bash
# Call place_order instruction
# Requires:
# - User wallet (signer)
# - Market account
# - User vault
# - Order account (new)
# - Order params (order_id, side, price, size)
```

**Verify:**
- Order account created on-chain
- Funds locked in user vault
- Order signature stored

### 4. Settle Trade (On-Chain)

**Test trade settlement:**

```bash
# Call settle_trade instruction
# Requires:
# - Authority (matching engine)
# - Market account
# - Maker and taker vaults
# - Maker and taker orders
# - Base and quote vaults
# - Fee recipient
# - Settlement params (fill_size, fill_price)
```

**Verify:**
- Funds transferred between vaults
- Fees collected
- Order status updated
- Vault balances updated

### 5. Withdraw Funds

**Test withdrawal:**

```bash
# Call withdraw instruction
# Requires:
# - User wallet (signer)
# - Market account
# - User vault
# - Token account (destination)
# - Amount to withdraw
```

**Verify:**
- Funds transferred to user token account
- Vault balance decreased
- User can use withdrawn funds

---

## End-to-End Scenarios

### Complete Trading Flow

**Scenario:** User deposits, places orders, trades execute, and user withdraws.

1. **Setup**
   - Market initialized (on-chain and in database)
   - User has SOL and USDC tokens

2. **Deposit**
   ```bash
   # Deposit 100 SOL and 10,000 USDC
   # (On-chain transaction)
   ```

3. **Place Buy Order**
   ```bash
   curl -X POST $API_URL/api/orders \
     -H "Content-Type: application/json" \
     -d "{
       \"market_id\": \"$MARKET_ID\",
       \"side\": \"buy\",
       \"price\": 100000000,
       \"size\": 10000000,
       \"wallet\": \"$WALLET1\",
       \"signature\": \"<on-chain-sig>\"
     }" | jq .
   ```

4. **Order Matches**
   - Another user places matching sell order
   - Trade executes
   - Funds settle on-chain

5. **Check Balances**
   - Verify user vault balances updated
   - Verify fees deducted correctly

6. **Withdraw**
   ```bash
   # Withdraw remaining funds
   # (On-chain transaction)
   ```

### Frontend Integration Test

1. **Open Frontend**
   - Navigate to http://localhost:3000
   - Should redirect to `/market/SOL-USDC`

2. **Connect Wallet**
   - Click "Connect Wallet"
   - Select wallet (Phantom, etc.)
   - Approve connection

3. **View Orderbook**
   - Verify orderbook displays correctly
   - Check bids and asks rendering

4. **Place Order via UI**
   - Select side (buy/sell)
   - Enter price and size
   - Click "Place Order"
   - Verify order appears in "Open Orders"

5. **Monitor Trades**
   - Check "Trade History" updates
   - Verify trade details correct

6. **Cancel Order**
   - Click cancel on open order
   - Verify order removed from orderbook

---

## WebSocket Testing

### Connect to WebSocket

```bash
# Using wscat (install: npm install -g wscat)
wscat -c ws://localhost:3001/ws
```

### Subscribe to Market

```json
{"type": "subscribe", "data": {"market_id": "00000000-0000-0000-0000-000000000001"}}
```

### Expected Messages

1. **Orderbook Snapshot** (on subscribe)
2. **Orderbook Update** (when orders change)
3. **Trade** (when trades execute)
4. **Order Update** (when order status changes)

### Test Flow

1. Subscribe to market
2. Place an order (in another terminal)
3. Verify WebSocket receives:
   - Orderbook update
   - Order update

---

## Error Testing

### Test Invalid Orders

1. **Order size below minimum:**
```bash
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"buy\",
    \"price\": 100000000,
    \"size\": 100000,
    \"wallet\": \"$WALLET1\",
    \"signature\": \"test\"
  }" | jq .
```

**Expected:** Error: "Order size 100000 is below minimum 1000000"

2. **Price not aligned to tick size:**
```bash
curl -X POST $API_URL/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"market_id\": \"$MARKET_ID\",
    \"side\": \"buy\",
    \"price\": 100000001,
    \"size\": 10000000,
    \"wallet\": \"$WALLET1\",
    \"signature\": \"test\"
  }" | jq .
```

**Expected:** Error: "Price 100000001 is not aligned to tick size 1000000"

3. **Invalid market ID:**
```bash
curl "$API_URL/api/markets/00000000-0000-0000-0000-000000000999" | jq .
```

**Expected:** Error: "Market not found"

4. **Cancel filled order:**
```bash
# Try to cancel an already filled order
curl -X DELETE "$API_URL/api/orders/<filled-order-id>" | jq .
```

**Expected:** Error: "Order cannot be cancelled"

---

## Performance Testing

### Load Test Order Placement

```bash
# Place 100 orders rapidly
for i in {1..100}; do
  curl -X POST $API_URL/api/orders \
    -H "Content-Type: application/json" \
    -d "{
      \"market_id\": \"$MARKET_ID\",
      \"side\": \"buy\",
      \"price\": $((95000000 + i * 100000)),
      \"size\": 1000000,
      \"wallet\": \"$WALLET1\",
      \"signature\": \"test-$i\"
    }" &
done
wait
```

### Verify Orderbook Performance

```bash
# Check orderbook with many orders
curl "$API_URL/api/markets/$MARKET_ID/orderbook?depth=50" | jq .
```

---

## Troubleshooting

### Program ID Mismatch

**Problem:** On-chain operations fail due to program ID mismatch.

**Solution:**
1. Get deployed program ID: `solana-keygen pubkey dcex-program/target/deploy/dcex-keypair.json`
2. Update `.env` files in matching-engine and dcex-frontend
3. Restart services

### Database Connection Issues

**Problem:** Matching engine can't connect to Postgres.

**Solution:**
1. Verify Docker container running: `docker-compose ps`
2. Check connection string in `.env`
3. Test connection: `docker exec -it dcex-postgres psql -U postgres -d dcex`

### Solana RPC Issues

**Problem:** Can't connect to Solana localnet.

**Solution:**
1. Verify validator running: `solana config get`
2. Test RPC: `curl -X POST http://localhost:8899 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'`
3. Check SOL balance: `solana balance`

### Order Not Matching

**Problem:** Orders placed but not matching.

**Solution:**
1. Check orderbook: `curl "$API_URL/api/markets/$MARKET_ID/orderbook"`
2. Verify prices align (buy >= sell for match)
3. Check order status: `curl "$API_URL/api/orders/<order_id>"`

---

## Test Checklist

Use this checklist to verify complete system functionality:

- [ ] Infrastructure running (Postgres, Redis, Solana)
- [ ] Program deployed successfully
- [ ] Matching engine running and healthy
- [ ] Frontend running and accessible
- [ ] Market exists in database
- [ ] Can fetch markets via API
- [ ] Can fetch orderbook
- [ ] Can place buy order
- [ ] Can place sell order
- [ ] Orders match correctly
- [ ] Partial fills work
- [ ] Orderbook updates correctly
- [ ] Trades recorded in database
- [ ] Fees calculated correctly
- [ ] Can cancel orders
- [ ] Can fetch user orders
- [ ] Can fetch trade history
- [ ] WebSocket connections work
- [ ] Frontend displays data correctly
- [ ] Error handling works
- [ ] On-chain deposit works (if configured)
- [ ] On-chain settlement works (if configured)
- [ ] On-chain withdraw works (if configured)

---

## Summary

This guide covers:
1. ✅ Complete infrastructure setup
2. ✅ Program deployment
3. ✅ Matching engine configuration
4. ✅ Frontend setup
5. ✅ All API endpoints tested
6. ✅ Trading flows verified
7. ✅ Error scenarios covered
8. ✅ Performance considerations

For production deployment, ensure:
- Proper security configurations
- Rate limiting on APIs
- Monitoring and logging
- Backup strategies for database
- Proper key management for Solana program
