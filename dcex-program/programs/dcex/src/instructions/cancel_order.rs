use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::DcexError;
use crate::state::{Market, Order, OrderSide, UserVault};

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [VAULT_SEED, user.key().as_ref(), market.key().as_ref()],
        bump = user_vault.bump,
        constraint = user_vault.user == user.key() @ DcexError::Unauthorized
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        mut,
        seeds = [ORDER_SEED, order.order_id.to_le_bytes().as_ref()],
        bump = order.bump,
        constraint = order.user == user.key() @ DcexError::Unauthorized,
        constraint = order.market == market.key() @ DcexError::InvalidMarketConfiguration
    )]
    pub order: Account<'info, Order>,
}

pub fn handler(ctx: Context<CancelOrder>) -> Result<()> {
    let market = &ctx.accounts.market;
    let user_vault = &mut ctx.accounts.user_vault;
    let order = &mut ctx.accounts.order;

    require!(order.is_active(), DcexError::InvalidOrderStatus);

    let remaining = order.remaining();

    let quote_amount = remaining
        .checked_mul(order.price)
        .ok_or(DcexError::ArithmeticOverflow)?
        .checked_div(10u64.pow(market.base_decimals as u32))
        .ok_or(DcexError::ArithmeticOverflow)?;

    match order.side {
        OrderSide::Buy => {
            user_vault.unlock_quote(quote_amount)?;
        }
        OrderSide::Sell => {
            user_vault.unlock_base(remaining)?;
        }
    }

    order.cancel()?;

    msg!("Order cancelled: id={}", order.order_id);

    Ok(())
}
