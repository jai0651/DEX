use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::DcexError;
use crate::state::Market;

#[derive(Accounts)]
#[instruction(params: InitializeMarketParams)]
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
    pub market: Box<Account<'info, Market>>,

    pub base_mint: Box<Account<'info, Mint>>,
    pub quote_mint: Box<Account<'info, Mint>>,

    /// CHECK: initialized via CPI
    #[account(
        mut,
        seeds = [ESCROW_SEED, market.key().as_ref(), b"base"],
        bump
    )]
    pub base_vault: AccountInfo<'info>,

    /// CHECK: initialized via CPI
    #[account(
        mut,
        seeds = [ESCROW_SEED, market.key().as_ref(), b"quote"],
        bump
    )]
    pub quote_vault: AccountInfo<'info>,

    /// CHECK: fee recipient
    pub fee_recipient: AccountInfo<'info>,

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

    let market_key = ctx.accounts.market.key();
    let base_vault_bump = ctx.bumps.base_vault;
    let quote_vault_bump = ctx.bumps.quote_vault;

    // Create base vault token account
    let base_seeds = &[ESCROW_SEED, market_key.as_ref(), b"base", &[base_vault_bump]];
    let base_signer = &[&base_seeds[..]];
    
    let rent = ctx.accounts.rent.to_account_info();
    let rent_lamports = Rent::get()?.minimum_balance(TokenAccount::LEN);
    
    anchor_lang::system_program::create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::CreateAccount {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.base_vault.to_account_info(),
            },
            base_signer,
        ),
        rent_lamports,
        TokenAccount::LEN as u64,
        &ctx.accounts.token_program.key(),
    )?;
    
    anchor_spl::token::initialize_account3(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::InitializeAccount3 {
                account: ctx.accounts.base_vault.to_account_info(),
                mint: ctx.accounts.base_mint.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
        ),
    )?;

    // Create quote vault token account  
    let quote_seeds = &[ESCROW_SEED, market_key.as_ref(), b"quote", &[quote_vault_bump]];
    let quote_signer = &[&quote_seeds[..]];
    
    anchor_lang::system_program::create_account(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::CreateAccount {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.quote_vault.to_account_info(),
            },
            quote_signer,
        ),
        rent_lamports,
        TokenAccount::LEN as u64,
        &ctx.accounts.token_program.key(),
    )?;
    
    anchor_spl::token::initialize_account3(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::InitializeAccount3 {
                account: ctx.accounts.quote_vault.to_account_info(),
                mint: ctx.accounts.quote_mint.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
        ),
    )?;

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

    Ok(())
}
