CREATE TABLE deposits (
    id BIGSERIAL PRIMARY KEY,
    user_wallet VARCHAR(44) NOT NULL,
    market_id UUID NOT NULL REFERENCES markets(id),
    amount BIGINT NOT NULL,
    is_base BOOLEAN NOT NULL,
    signature VARCHAR(88) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deposits_user_wallet ON deposits(user_wallet);
CREATE INDEX idx_deposits_market_id ON deposits(market_id);
CREATE INDEX idx_deposits_created_at ON deposits(created_at);
CREATE INDEX idx_deposits_signature ON deposits(signature);

CREATE TABLE withdrawals (
    id BIGSERIAL PRIMARY KEY,
    user_wallet VARCHAR(44) NOT NULL,
    market_id UUID NOT NULL REFERENCES markets(id),
    amount BIGINT NOT NULL,
    is_base BOOLEAN NOT NULL,
    signature VARCHAR(88) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_user_wallet ON withdrawals(user_wallet);
CREATE INDEX idx_withdrawals_market_id ON withdrawals(market_id);
CREATE INDEX idx_withdrawals_created_at ON withdrawals(created_at);
CREATE INDEX idx_withdrawals_signature ON withdrawals(signature);
