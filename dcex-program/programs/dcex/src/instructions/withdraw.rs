use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::errors::DcexError;
use crate::state::{Market, UserVault};

#[derive(Accounts)]
pub struct Withdraw<'info> {
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
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == market.base_mint || user_token_account.mint == market.quote_mint
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = market_vault.key() == market.base_vault || market_vault.key() == market.quote_vault
    )]
    pub market_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WithdrawParams {
    pub amount: u64,
    pub is_base: bool,
}

pub fn handler(ctx: Context<Withdraw>, params: WithdrawParams) -> Result<()> {
    require!(params.amount > 0, DcexError::InvalidOrderSize);

    if params.is_base {
        require!(
            ctx.accounts.user_token_account.mint == ctx.accounts.market.base_mint,
            DcexError::InvalidMarketConfiguration
        );
        require!(
            ctx.accounts.market_vault.key() == ctx.accounts.market.base_vault,
            DcexError::InvalidMarketConfiguration
        );
        require!(
            ctx.accounts.market_vault.mint == ctx.accounts.market.base_mint,
            DcexError::InvalidMarketConfiguration
        );
    } else {
        require!(
            ctx.accounts.user_token_account.mint == ctx.accounts.market.quote_mint,
            DcexError::InvalidMarketConfiguration
        );
        require!(
            ctx.accounts.market_vault.key() == ctx.accounts.market.quote_vault,
            DcexError::InvalidMarketConfiguration
        );
        require!(
            ctx.accounts.market_vault.mint == ctx.accounts.market.quote_mint,
            DcexError::InvalidMarketConfiguration
        );
    }

    let user_vault = &mut ctx.accounts.user_vault;

    if params.is_base {
        require!(
            user_vault.available_base() >= params.amount,
            DcexError::InsufficientBalance
        );
        user_vault.base_balance = user_vault.base_balance
            .checked_sub(params.amount)
            .ok_or(DcexError::ArithmeticOverflow)?;
        user_vault.total_base_withdrawn = user_vault.total_base_withdrawn
            .checked_add(params.amount)
            .ok_or(DcexError::ArithmeticOverflow)?;
    } else {
        require!(
            user_vault.available_quote() >= params.amount,
            DcexError::InsufficientBalance
        );
        user_vault.quote_balance = user_vault.quote_balance
            .checked_sub(params.amount)
            .ok_or(DcexError::ArithmeticOverflow)?;
        user_vault.total_quote_withdrawn = user_vault.total_quote_withdrawn
            .checked_add(params.amount)
            .ok_or(DcexError::ArithmeticOverflow)?;
    }

    let seeds = &[
        MARKET_SEED,
        ctx.accounts.market.base_mint.as_ref(),
        ctx.accounts.market.quote_mint.as_ref(),
        &[ctx.accounts.market.bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.market_vault.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.market.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, params.amount)?;

    msg!(
        "Withdrew {} {} tokens for user {}",
        params.amount,
        if params.is_base { "base" } else { "quote" },
        ctx.accounts.user.key()
    );

    Ok(())
}
