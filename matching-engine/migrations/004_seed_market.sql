INSERT INTO markets (
    id, 
    base_mint, 
    quote_mint, 
    base_decimals, 
    quote_decimals, 
    min_order_size, 
    tick_size, 
    maker_fee_bps, 
    taker_fee_bps, 
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'So11111111111111111111111111111111111111112',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    9,
    6,
    1000000,
    1000000,
    5,
    10,
    true
) ON CONFLICT (base_mint, quote_mint) DO NOTHING;
