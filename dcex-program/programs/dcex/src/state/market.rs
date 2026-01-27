use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct Market {
    pub authority: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub base_decimals: u8,
    pub quote_decimals: u8,
    pub min_order_size: u64,
    pub tick_size: u64,
    pub maker_fee_bps: u16,
    pub taker_fee_bps: u16,
    pub fee_recipient: Pubkey,
    pub is_active: bool,
    pub total_base_deposited: u64,
    pub total_quote_deposited: u64,
    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // base_mint
        32 + // quote_mint
        32 + // base_vault
        32 + // quote_vault
        1 +  // base_decimals
        1 +  // quote_decimals
        8 +  // min_order_size
        8 +  // tick_size
        2 +  // maker_fee_bps
        2 +  // taker_fee_bps
        32 + // fee_recipient
        1 +  // is_active
        8 +  // total_base_deposited
        8 +  // total_quote_deposited
        1 +  // bump
        64;  // padding for future fields

    pub fn validate_order_size(&self, size: u64) -> bool {
        size >= self.min_order_size
    }

    pub fn validate_price(&self, price: u64) -> bool {
        price > 0 && price % self.tick_size == 0
    }

    pub fn calculate_maker_fee(&self, amount: u64) -> Option<u64> {
        amount.checked_mul(self.maker_fee_bps as u64)?.checked_div(10000)
    }

    pub fn calculate_taker_fee(&self, amount: u64) -> Option<u64> {
        amount.checked_mul(self.taker_fee_bps as u64)?.checked_div(10000)
    }
}
