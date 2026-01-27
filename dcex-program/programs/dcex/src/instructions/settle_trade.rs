use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::DcexError;
use crate::state::{Market, Order, OrderSide, UserVault};

#[derive(Accounts)]
pub struct SettleTrade<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        constraint = market.is_active @ DcexError::MarketNotActive,
        constraint = market.authority == authority.key() @ DcexError::Unauthorized
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [VAULT_SEED, maker_order.user.as_ref(), market.key().as_ref()],
        bump = maker_vault.bump
    )]
    pub maker_vault: Account<'info, UserVault>,

    #[account(
        mut,
        seeds = [VAULT_SEED, taker_order.user.as_ref(), market.key().as_ref()],
        bump = taker_vault.bump
    )]
    pub taker_vault: Account<'info, UserVault>,

    #[account(
        mut,
        seeds = [ORDER_SEED, maker_order.order_id.to_le_bytes().as_ref()],
        bump = maker_order.bump
    )]
    pub maker_order: Account<'info, Order>,

    #[account(
        mut,
        seeds = [ORDER_SEED, taker_order.order_id.to_le_bytes().as_ref()],
        bump = taker_order.bump
    )]
    pub taker_order: Account<'info, Order>,

    #[account(
        mut,
        constraint = base_vault.key() == market.base_vault
    )]
    pub base_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = quote_vault.key() == market.quote_vault
    )]
    pub quote_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub fee_recipient: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SettleTradeParams {
    pub fill_size: u64,
    pub fill_price: u64,
}

pub fn handler(ctx: Context<SettleTrade>, params: SettleTradeParams) -> Result<()> {
    let market = &ctx.accounts.market;
    let maker_vault = &mut ctx.accounts.maker_vault;
    let taker_vault = &mut ctx.accounts.taker_vault;
    let maker_order = &mut ctx.accounts.maker_order;
    let taker_order = &mut ctx.accounts.taker_order;

    require!(maker_order.is_active(), DcexError::InvalidOrderStatus);
    require!(taker_order.is_active(), DcexError::InvalidOrderStatus);
    require!(
        maker_order.remaining() >= params.fill_size,
        DcexError::SettlementAmountMismatch
    );
    require!(
        taker_order.remaining() >= params.fill_size,
        DcexError::SettlementAmountMismatch
    );

    let base_amount = params.fill_size;
    let quote_amount = params.fill_size
        .checked_mul(params.fill_price)
        .ok_or(DcexError::ArithmeticOverflow)?
        .checked_div(10u64.pow(market.base_decimals as u32))
        .ok_or(DcexError::ArithmeticOverflow)?;

    let maker_fee = market.calculate_maker_fee(quote_amount)
        .ok_or(DcexError::ArithmeticOverflow)?;
    let taker_fee = market.calculate_taker_fee(quote_amount)
        .ok_or(DcexError::ArithmeticOverflow)?;

    match maker_order.side {
        OrderSide::Sell => {
            maker_vault.unlock_base(base_amount)?;
            maker_vault.base_balance = maker_vault.base_balance
                .checked_sub(base_amount)
                .ok_or(DcexError::ArithmeticOverflow)?;
            maker_vault.quote_balance = maker_vault.quote_balance
                .checked_add(quote_amount.saturating_sub(maker_fee))
                .ok_or(DcexError::ArithmeticOverflow)?;

            taker_vault.unlock_quote(quote_amount)?;
            taker_vault.quote_balance = taker_vault.quote_balance
                .checked_sub(quote_amount)
                .ok_or(DcexError::ArithmeticOverflow)?;
            taker_vault.base_balance = taker_vault.base_balance
                .checked_add(base_amount)
                .ok_or(DcexError::ArithmeticOverflow)?;
            
            taker_vault.quote_balance = taker_vault.quote_balance
                .saturating_sub(taker_fee);
        }
        OrderSide::Buy => {
            maker_vault.unlock_quote(quote_amount)?;
            maker_vault.quote_balance = maker_vault.quote_balance
                .checked_sub(quote_amount)
                .ok_or(DcexError::ArithmeticOverflow)?;
            maker_vault.base_balance = maker_vault.base_balance
                .checked_add(base_amount)
                .ok_or(DcexError::ArithmeticOverflow)?;
            
            maker_vault.quote_balance = maker_vault.quote_balance
                .saturating_sub(maker_fee);

            taker_vault.unlock_base(base_amount)?;
            taker_vault.base_balance = taker_vault.base_balance
                .checked_sub(base_amount)
                .ok_or(DcexError::ArithmeticOverflow)?;
            taker_vault.quote_balance = taker_vault.quote_balance
                .checked_add(quote_amount.saturating_sub(taker_fee))
                .ok_or(DcexError::ArithmeticOverflow)?;
        }
    }

    maker_order.fill(params.fill_size)?;
    taker_order.fill(params.fill_size)?;

    msg!(
        "Trade settled: maker={}, taker={}, size={}, price={}",
        maker_order.order_id,
        taker_order.order_id,
        params.fill_size,
        params.fill_price
    );

    Ok(())
}
