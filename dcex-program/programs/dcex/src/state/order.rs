use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum OrderSide {
    Buy,
    Sell,
}

impl Default for OrderSide {
    fn default() -> Self {
        OrderSide::Buy
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum OrderStatus {
    Pending,
    PartiallyFilled,
    Filled,
    Cancelled,
}

impl Default for OrderStatus {
    fn default() -> Self {
        OrderStatus::Pending
    }
}

#[account]
#[derive(Default)]
pub struct Order {
    pub user: Pubkey,
    pub market: Pubkey,
    pub order_id: u128,
    pub side: OrderSide,
    pub price: u64,
    pub size: u64,
    pub filled: u64,
    pub status: OrderStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl Order {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        32 + // market
        16 + // order_id (u128)
        1 +  // side
        8 +  // price
        8 +  // size
        8 +  // filled
        1 +  // status
        8 +  // created_at
        8 +  // updated_at
        1 +  // bump
        32;  // padding

    pub fn remaining(&self) -> u64 {
        self.size.saturating_sub(self.filled)
    }

    pub fn is_active(&self) -> bool {
        matches!(self.status, OrderStatus::Pending | OrderStatus::PartiallyFilled)
    }

    pub fn fill(&mut self, amount: u64) -> Result<()> {
        self.filled = self.filled.checked_add(amount)
            .ok_or(crate::errors::DcexError::ArithmeticOverflow)?;
        
        if self.filled >= self.size {
            self.status = OrderStatus::Filled;
        } else if self.filled > 0 {
            self.status = OrderStatus::PartiallyFilled;
        }
        
        self.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn cancel(&mut self) -> Result<()> {
        require!(
            self.is_active(),
            crate::errors::DcexError::InvalidOrderStatus
        );
        self.status = OrderStatus::Cancelled;
        self.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn quote_amount(&self) -> Option<u64> {
        self.size.checked_mul(self.price)?.checked_div(1_000_000_000) // Assuming 9 decimals for price
    }
}
