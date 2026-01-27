use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::DcexError;
use crate::state::Market;

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Market::LEN,
        seeds = [MARKET_SEED, base_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,

    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = base_mint,
        token::authority = market,
        seeds = [ESCROW_SEED, market.key().as_ref(), b"base"],
        bump
    )]
    pub base_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = authority,
        token::mint = quote_mint,
        token::authority = market,
        seeds = [ESCROW_SEED, market.key().as_ref(), b"quote"],
        bump
    )]
    pub quote_vault: Account<'info, TokenAccount>,

    pub fee_recipient: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeMarketParams {
    pub min_order_size: u64,
    pub tick_size: u64,
    pub maker_fee_bps: u16,
    pub taker_fee_bps: u16,
}

pub fn handler(ctx: Context<InitializeMarket>, params: InitializeMarketParams) -> Result<()> {
    require!(
        params.maker_fee_bps <= MAX_MAKER_FEE_BPS,
        DcexError::InvalidFeeConfiguration
    );
    require!(
        params.taker_fee_bps <= MAX_TAKER_FEE_BPS,
        DcexError::InvalidFeeConfiguration
    );
    require!(
        params.min_order_size >= MIN_ORDER_SIZE,
        DcexError::InvalidMarketConfiguration
    );
    require!(
        params.tick_size > 0,
        DcexError::InvalidMarketConfiguration
    );

    let market = &mut ctx.accounts.market;
    
    market.authority = ctx.accounts.authority.key();
    market.base_mint = ctx.accounts.base_mint.key();
    market.quote_mint = ctx.accounts.quote_mint.key();
    market.base_vault = ctx.accounts.base_vault.key();
    market.quote_vault = ctx.accounts.quote_vault.key();
    market.base_decimals = ctx.accounts.base_mint.decimals;
    market.quote_decimals = ctx.accounts.quote_mint.decimals;
    market.min_order_size = params.min_order_size;
    market.tick_size = params.tick_size;
    market.maker_fee_bps = params.maker_fee_bps;
    market.taker_fee_bps = params.taker_fee_bps;
    market.fee_recipient = ctx.accounts.fee_recipient.key();
    market.is_active = true;
    market.bump = ctx.bumps.market;

    msg!("Market initialized: base={}, quote={}", 
        market.base_mint, 
        market.quote_mint
    );

    Ok(())
}
