## Overview

This repository is a monorepo for a Solana-first web3 trading and payments stack. It contains:

- **`dcex`**: A decentralized exchange composed of an on-chain Anchor program, an off-chain Rust matching engine, and a Next.js trading frontend.
- **`web3-api-gateway`**: A Next.js/Bun app that provides a Stripe-like API gateway, merchant dashboard, and checkout experience backed by Prisma and Redis.
- **`lst`**: A bridge/experiments area for TypeScript- and Solana-based tooling (see its own subdirectories for details).

Each subproject is independently deployable but designed to work together for end-to-end web3 trading and payments flows.

## High-level architecture

- **On-chain layer (Solana, Anchor)**
  - `dcex/dcex-program`: Anchor program defining markets, orders, user vaults, and settlement logic.
  - Exposes instructions for placing/cancelling orders, deposits/withdrawals, and settling trades.
- **Off-chain matching & settlement (Rust, Axum, SQLx, Redis)**
  - `dcex/matching-engine`: Axum-based HTTP + WebSocket service implementing:
    - In-memory orderbooks and price-time priority matching.
    - Postgres persistence via `sqlx` for markets, orders, and trades.
    - Redis integration for caching and pub/sub style notifications.
    - Solana integration via `solana-sdk` and `anchor-client` for settlement.
- **Trading frontend (Next.js App Router)**
  - `dcex/dcex-frontend`: Next.js 14 app-router UI for trading:
    - Orderbook, trade history, open orders, and order form components.
    - Solana wallet connection and transaction signing.
    - React Query + Zustand stores for real-time trading state.
- **API gateway & payments (Next.js, Bun, Prisma, Redis)**
  - `web3-api-gateway`: Next.js 16 app (Bun) that provides:
    - Auth flows (NextAuth) and merchant onboarding.
    - Dashboard for payments, webhooks, and settings.
    - Public checkout pages and v1 API endpoints.
    - Prisma/Postgres for persistence and Redis for fast access/token-style data.

### Typical DEX data flow (simplified)

1. **User trades** on `dcex-frontend` using a connected Solana wallet.
2. **Frontend** calls the `matching-engine` HTTP/WebSocket APIs to place/cancel orders and stream orderbook + trade updates.
3. **Matching engine**:
   - Maintains orderbooks in memory.
   - Persists orders and fills to Postgres.
   - Publishes events via websockets.
4. **Settlement module** in the matching engine uses `anchor-client` to send batched settlement transactions to the `dcex-program` on Solana.

### Typical payments/API flow (simplified)

1. **Merchant** configures products and webhooks via the `web3-api-gateway` dashboard.
2. **Customer** hits a public `checkout/[id]` page or merchant-initiated API call under `src/app/api/v1`.
3. **Gateway** verifies Solana-side signatures/payments, persists state via Prisma/Postgres, and triggers outbound webhooks for merchant systems.

## Projects

### `dcex/dcex-program` (Solana Anchor program)

- **Purpose**: On-chain state and logic for markets, orders, user vaults, and settlement.
- **Stack**: Rust, Anchor, Solana.
- **Key modules**:
  - `state/market.rs`, `state/order.rs`, `state/user_vault.rs` – core on-chain data structures.
  - `instructions/*.rs` – market initialization, deposit/withdraw, place/cancel order, settle trade.
- **Build & test**:
  - Install Anchor + Solana CLI.
  - Use `anchor build` / `anchor test` from `dcex/dcex-program`.

### `dcex/matching-engine` (Rust Axum service)

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
  - Start the service with `cargo run` from `dcex/matching-engine`.

### `dcex/dcex-frontend` (Trading UI)

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
  - Install dependencies in `dcex/dcex-frontend` (e.g. `bun install`).
  - Configure environment via `.env.local` (see `.env.local.example`).
  - Start dev server: `bun dev`.

### `web3-api-gateway` (Payments & API gateway)

- **Purpose**: Merchant-facing dashboard and public API/checkout flows, inspired by Stripe but backed by Solana.
- **Stack**:
  - Next.js 16 (App Router) run with Bun.
  - TypeScript, Tailwind CSS, shadcn/ui-style components in `src/components/ui`.
  - Auth: `next-auth`.
  - Persistence: Prisma with Postgres (`prisma/schema.prisma`).
  - Caching/ephemeral data: Redis (`src/lib/redis.ts`).
  - Solana signature/transaction verification utilities under `src/lib/solana`.
- **Key features**:
  - Auth and onboarding under `(auth)` routes.
  - Merchant dashboard under `(dashboard)` routes with sections for payments, webhooks, and settings.
  - Public checkout flows under `src/app/checkout/[id]`.
  - Versioned HTTP APIs under `src/app/api/v1`.
- **Running locally**:
  - From `web3-api-gateway`:
    - Copy `env.template` to `.env` and configure keys.
    - Run `bun install`.
    - Run Prisma migrations (`bun prisma migrate dev` or equivalent).
    - Start dev server: `bun dev`.
  - See `web3-api-gateway/README.md` for Next.js-specific details.

### `lst` (bridge and experiments)

- **Purpose**: Houses a larger TypeScript/Solana bridge project and related experiments under `bridge/`.
- **Notes**:
  - Use `ls` / your editor to explore subfolders (e.g. contracts, SDKs, workers).
  - Follow each submodule’s own tooling and scripts (e.g. `package.json`, `tsconfig`, or anchors if present).

## Technologies

- **Languages**: TypeScript, Rust, Solana/Anchor.
- **Frontend**: Next.js App Router, React, Tailwind CSS, shadcn-style UI components.
- **Backend**:
  - Rust (`axum`, `sqlx`, `redis`) for matching engine.
  - Next.js API routes (with Bun) for web3-api-gateway.
- **Datastores**: Postgres (via SQLx/Prisma), Redis.
- **Blockchain**: Solana (`@solana/web3.js`, `solana-sdk`, `anchor-client`).
- **Auth & security**: NextAuth, bcrypt, token-like flows for merchants, Solana signature verification.

## Local development (quick start)

- **Prerequisites**:
  - Bun and Node.js (for Next.js apps).
  - Rust toolchain (for `matching-engine` and Anchor program).
  - Solana + Anchor CLIs.
  - Postgres and Redis (locally or via Docker).
- **Recommended workflow**:
  1. Start infrastructure (Postgres, Redis, localnet) via Docker Compose files where provided.
  2. Run `matching-engine` and `dcex-program` for trading flows.
  3. Run `dcex-frontend` to trade against the engine.
  4. Run `web3-api-gateway` for merchant/API/payment flows.

## Conventions

- **Package manager**: Bun is preferred for the Next.js projects (lockfiles are checked in).
- **Style**:
  - Use Tailwind CSS and existing UI primitives/components by default.
  - Follow framework best practices (Next.js app router, file-based routing, server vs client components).
- **Structure**:
  - Each subproject is self-contained with its own config (`Cargo.toml`, `package.json`, `Anchor.toml`, etc.).
  - Shared concepts (markets, orders, trades) are mirrored across on-chain program, matching engine, and frontend types.

