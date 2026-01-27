CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_mint VARCHAR(44) NOT NULL,
    quote_mint VARCHAR(44) NOT NULL,
    base_decimals SMALLINT NOT NULL,
    quote_decimals SMALLINT NOT NULL,
    min_order_size BIGINT NOT NULL,
    tick_size BIGINT NOT NULL,
    maker_fee_bps SMALLINT NOT NULL DEFAULT 0,
    taker_fee_bps SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(base_mint, quote_mint)
);

CREATE INDEX idx_markets_active ON markets(is_active);
CREATE INDEX idx_markets_mints ON markets(base_mint, quote_mint);
