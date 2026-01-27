CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT UNIQUE NOT NULL,
    user_wallet VARCHAR(44) NOT NULL,
    market_id UUID NOT NULL REFERENCES markets(id),
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    price BIGINT NOT NULL,
    size BIGINT NOT NULL,
    filled BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partiallyfilled', 'filled', 'cancelled')),
    on_chain_signature VARCHAR(88),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_wallet ON orders(user_wallet);
CREATE INDEX idx_orders_market_status ON orders(market_id, status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_order_id ON orders(order_id);
