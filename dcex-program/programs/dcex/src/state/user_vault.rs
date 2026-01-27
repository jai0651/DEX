use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct UserVault {
    pub user: Pubkey,
    pub market: Pubkey,
    pub base_balance: u64,
    pub quote_balance: u64,
    pub base_locked: u64,
    pub quote_locked: u64,
    pub total_base_deposited: u64,
    pub total_quote_deposited: u64,
    pub total_base_withdrawn: u64,
    pub total_quote_withdrawn: u64,
    pub bump: u8,
}

impl UserVault {
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        32 + // market
        8 +  // base_balance
        8 +  // quote_balance
        8 +  // base_locked
        8 +  // quote_locked
        8 +  // total_base_deposited
        8 +  // total_quote_deposited
        8 +  // total_base_withdrawn
        8 +  // total_quote_withdrawn
        1 +  // bump
        64;  // padding

    pub fn available_base(&self) -> u64 {
        self.base_balance.saturating_sub(self.base_locked)
    }

    pub fn available_quote(&self) -> u64 {
        self.quote_balance.saturating_sub(self.quote_locked)
    }

    pub fn lock_base(&mut self, amount: u64) -> Result<()> {
        require!(
            self.available_base() >= amount,
            crate::errors::DcexError::InsufficientBalance
        );
        self.base_locked = self.base_locked.checked_add(amount)
            .ok_or(crate::errors::DcexError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn lock_quote(&mut self, amount: u64) -> Result<()> {
        require!(
            self.available_quote() >= amount,
            crate::errors::DcexError::InsufficientBalance
        );
        self.quote_locked = self.quote_locked.checked_add(amount)
            .ok_or(crate::errors::DcexError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn unlock_base(&mut self, amount: u64) -> Result<()> {
        self.base_locked = self.base_locked.checked_sub(amount)
            .ok_or(crate::errors::DcexError::ArithmeticOverflow)?;
        Ok(())
    }

    pub fn unlock_quote(&mut self, amount: u64) -> Result<()> {
        self.quote_locked = self.quote_locked.checked_sub(amount)
            .ok_or(crate::errors::DcexError::ArithmeticOverflow)?;
        Ok(())
    }
}
