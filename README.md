## Overview

This repository is a Solana-first decentralized exchange (DEX) stack. It contains:

- **`dcex-program/`**: The on-chain Solana Anchor program for markets, orders, user vaults, and settlement.
- **`matching-engine/`**: The off-chain Rust matching engine and settlement service.
- **`dcex-frontend/`**: The Next.js trading frontend.

These projects are independently runnable but designed to work together for end‑to‑end trading flows.

## High-level architecture

- **On-chain layer (Solana, Anchor)**
  - `dcex-program/`: Anchor program defining markets, orders, user vaults, and settlement logic.
  - Exposes instructions for placing/cancelling orders, deposits/withdrawals, and settling trades.
- **Off-chain matching & settlement (Rust, Axum, SQLx, Redis)**
  - `matching-engine/`: Axum-based HTTP + WebSocket service implementing:
    - In-memory orderbooks and price-time priority matching.
    - Postgres persistence via `sqlx` for markets, orders, and trades.
    - Redis integration for caching and pub/sub-style notifications.
    - Solana integration via `solana-sdk` and `anchor-client` for settlement.
- **Trading frontend (Next.js App Router)**
  - `dcex-frontend/`: Next.js 14 App Router UI for trading:
    - Orderbook, trade history, open orders, and order form components.
    - Solana wallet connection and transaction signing.
    - React Query + Zustand stores for real-time trading state.

### Typical DEX data flow (simplified)

1. **User trades** on `dcex-frontend` using a connected Solana wallet.
2. **Frontend** calls the `matching-engine` HTTP/WebSocket APIs to place/cancel orders and stream orderbook + trade updates.
3. **Matching engine**:
   - Maintains orderbooks in memory.
   - Persists orders and fills to Postgres.
   - Publishes events via WebSockets.
4. A **settlement module** in the matching engine uses `anchor-client` to send batched settlement transactions to the `dcex-program` on Solana.

## Projects

### `dcex-program/` (Solana Anchor program)

- **Purpose**: On-chain state and logic for markets, orders, user vaults, and settlement.
- **Stack**: Rust, Anchor, Solana.
- **Key modules**:
  - `programs/dcex/src/state/market.rs`, `state/order.rs`, `state/user_vault.rs` – core on-chain data structures.
  - `programs/dcex/src/instructions/*.rs` – market initialization, deposit/withdraw, place/cancel order, settle trade.
- **Build & test**:
  - Install Anchor + Solana CLI.
  - From `dcex-program/` run `anchor build` / `anchor test`.

### `matching-engine/` (Rust Axum service)

- **Purpose**: Off-chain order matching engine with persistence and Solana settlement.
- **Stack**:
  - Rust 2021, `axum`, `sqlx`, `redis`, `tokio`, `tracing`.
  - Solana integration via `solana-sdk` and `anchor-client`.
- **Key modules**:
  - `src/orderbook/*` – orderbook representation and matching logic.
  - `src/api/*` – REST routes, handlers, and WebSocket handlers.
  - `src/db.rs` – Postgres access via `sqlx` and migrations in `migrations/`.
  - `src/settlement` – integration with the on-chain Anchor program.
- **Running locally**:
  - Copy `.env.example` to `.env` and update Postgres, Redis, and Solana RPC URLs.
  - Apply migrations (e.g. via `sqlx migrate run` or Docker Compose).
  - From `matching-engine/` run `cargo run`.

### `dcex-frontend/` (Trading UI)

- **Purpose**: Web UI for market discovery, placing orders, viewing orderbooks, and monitoring trades.
- **Stack**:
  - Next.js 14 (App Router), React 18, TypeScript.
  - Tailwind CSS and headless UI primitives (shadcn-style components in `components/ui`).
  - State and data:
    - React Query for server data.
    - Zustand store under `src/lib/stores`.
  - Solana integration:
    - `@solana/web3.js`, `@coral-xyz/anchor`, wallet adapter packages.
- **Key folders**:
  - `src/app` – routing, layout, and top-level pages including `(trading)/market/[pair]`.
  - `src/components/trading` – `Orderbook`, `OrderForm`, `OpenOrders`, `TradeHistory`.
  - `src/lib/api` – REST and WebSocket clients to the matching engine.
  - `src/lib/solana` – program + vault helpers.
- **Running locally** (using Bun by default):
  - From `dcex-frontend/` run `bun install`.
  - Configure environment via `.env.local` (see `.env.local.example`).
  - Start dev server with `bun dev`.

## Technologies

- **Languages**: TypeScript, Rust, Solana/Anchor.
- **Frontend**: Next.js App Router, React, Tailwind CSS, shadcn-style UI components.
- **Backend**:
  - Rust (`axum`, `sqlx`, `redis`) for the matching engine.
- **Datastores**: Postgres (via SQLx), Redis.
- **Blockchain**: Solana (`@solana/web3.js`, `solana-sdk`, `anchor-client`).

## Local development (quick start)

- **Prerequisites**:
  - Bun and Node.js (for the Next.js app).
  - Rust toolchain (for `matching-engine/` and `dcex-program/`).
  - Solana + Anchor CLIs.
  - Postgres and Redis (locally or via Docker).
- **Recommended workflow**:
  1. Start infrastructure (Postgres, Redis, Solana localnet) via `docker-compose.yml` or your own setup.
  2. From `matching-engine/`, run database migrations and start the service.
  3. From `dcex-program/`, build/test and deploy the Anchor program to your chosen cluster (e.g. localnet).
  4. From `dcex-frontend/`, start the Next.js dev server and trade against the engine.

## Conventions

- **Package manager**: Bun is preferred for the Next.js project (`dcex-frontend/`).
- **Style**:
  - Use Tailwind CSS and existing UI primitives/components by default.
  - Follow Next.js App Router best practices (file-based routing, server vs client components).
- **Structure**:
  - Each subproject is self-contained with its own config (`Cargo.toml`, `package.json`, `Anchor.toml`, etc.).
  - Shared concepts (markets, orders, trades) are mirrored across on-chain program, matching engine, and frontend types.

