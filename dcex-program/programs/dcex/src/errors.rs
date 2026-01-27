use anchor_lang::prelude::*;

#[error_code]
pub enum DcexError {
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Market is not active")]
    MarketNotActive,
    
    #[msg("Insufficient balance")]
    InsufficientBalance,
    
    #[msg("Invalid order size")]
    InvalidOrderSize,
    
    #[msg("Invalid price")]
    InvalidPrice,
    
    #[msg("Order size below minimum")]
    OrderSizeBelowMinimum,
    
    #[msg("Price not aligned to tick size")]
    PriceNotAlignedToTick,
    
    #[msg("Order already filled")]
    OrderAlreadyFilled,
    
    #[msg("Order already cancelled")]
    OrderAlreadyCancelled,
    
    #[msg("Invalid order status")]
    InvalidOrderStatus,
    
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    
    #[msg("Invalid fee configuration")]
    InvalidFeeConfiguration,
    
    #[msg("Settlement amount mismatch")]
    SettlementAmountMismatch,
    
    #[msg("Invalid market configuration")]
    InvalidMarketConfiguration,
}
