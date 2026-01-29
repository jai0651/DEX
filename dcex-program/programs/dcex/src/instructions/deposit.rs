use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::DcexError;
use crate::state::{Market, UserVault};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        constraint = market.is_active @ DcexError::MarketNotActive
    )]
    pub market: Account<'info, Market>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserVault::LEN,
        seeds = [VAULT_SEED, user.key().as_ref(), market.key().as_ref()],
        bump
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == market.base_mint || user_token_account.mint == market.quote_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = (market_vault.key() == market.base_vault && user_token_account.mint == market.base_mint) ||
                     (market_vault.key() == market.quote_vault && user_token_account.mint == market.quote_mint)
    )]
    pub market_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositParams {
    pub amount: u64,
    pub is_base: bool,
}

pub fn handler(ctx: Context<Deposit>, params: DepositParams) -> Result<()> {
    require!(params.amount > 0, DcexError::InvalidOrderSize);

    let user_vault = &mut ctx.accounts.user_vault;
    
    if user_vault.user == Pubkey::default() {
        user_vault.user = ctx.accounts.user.key();
        user_vault.market = ctx.accounts.market.key();
        user_vault.bump = ctx.bumps.user_vault;
    } else {
        require!(
            user_vault.user == ctx.accounts.user.key(),
            DcexError::Unauthorized
        );
        require!(
            user_vault.market == ctx.accounts.market.key(),
            DcexError::InvalidMarketConfiguration
        );
    }

    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.market_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, params.amount)?;

    if params.is_base {
        user_vault.base_balance = user_vault.base_balance
            .checked_add(params.amount)
            .ok_or(DcexError::ArithmeticOverflow)?;
        user_vault.total_base_deposited = user_vault.total_base_deposited
            .checked_add(params.amount)
            .ok_or(DcexError::ArithmeticOverflow)?;
    } else {
        user_vault.quote_balance = user_vault.quote_balance
            .checked_add(params.amount)
            .ok_or(DcexError::ArithmeticOverflow)?;
        user_vault.total_quote_deposited = user_vault.total_quote_deposited
            .checked_add(params.amount)
            .ok_or(DcexError::ArithmeticOverflow)?;
    }

    msg!(
        "Deposited {} {} tokens for user {}",
        params.amount,
        if params.is_base { "base" } else { "quote" },
        ctx.accounts.user.key()
    );

    Ok(())
}
