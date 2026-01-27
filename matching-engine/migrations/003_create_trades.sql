CREATE TABLE trades (
    id BIGSERIAL PRIMARY KEY,
    market_id UUID NOT NULL REFERENCES markets(id),
    maker_order_id BIGINT NOT NULL,
    taker_order_id BIGINT NOT NULL,
    maker_wallet VARCHAR(44) NOT NULL,
    taker_wallet VARCHAR(44) NOT NULL,
    price BIGINT NOT NULL,
    size BIGINT NOT NULL,
    maker_fee BIGINT NOT NULL DEFAULT 0,
    taker_fee BIGINT NOT NULL DEFAULT 0,
    settlement_signature VARCHAR(88),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trades_market_time ON trades(market_id, created_at);
CREATE INDEX idx_trades_maker_wallet ON trades(maker_wallet);
CREATE INDEX idx_trades_taker_wallet ON trades(taker_wallet);
