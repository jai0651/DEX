use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::DcexError;
use crate::state::{Market, Order, OrderSide, OrderStatus, UserVault};

#[derive(Accounts)]
#[instruction(params: PlaceOrderParams)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        constraint = market.is_active @ DcexError::MarketNotActive
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [VAULT_SEED, user.key().as_ref(), market.key().as_ref()],
        bump = user_vault.bump,
        constraint = user_vault.user == user.key() @ DcexError::Unauthorized
    )]
    pub user_vault: Account<'info, UserVault>,

    #[account(
        init,
        payer = user,
        space = Order::LEN,
        seeds = [ORDER_SEED, params.order_id.to_le_bytes().as_ref()],
        bump
    )]
    pub order: Account<'info, Order>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PlaceOrderParams {
    pub order_id: u128,
    pub side: OrderSide,
    pub price: u64,
    pub size: u64,
}

pub fn handler(ctx: Context<PlaceOrder>, params: PlaceOrderParams) -> Result<()> {
    let market = &ctx.accounts.market;
    let user_vault = &mut ctx.accounts.user_vault;
    let order = &mut ctx.accounts.order;

    require!(
        market.validate_order_size(params.size),
        DcexError::OrderSizeBelowMinimum
    );
    require!(
        market.validate_price(params.price),
        DcexError::PriceNotAlignedToTick
    );

    let quote_amount = params.size
        .checked_mul(params.price)
        .ok_or(DcexError::ArithmeticOverflow)?
        .checked_div(10u64.pow(market.base_decimals as u32))
        .ok_or(DcexError::ArithmeticOverflow)?;

    match params.side {
        OrderSide::Buy => {
            user_vault.lock_quote(quote_amount)?;
        }
        OrderSide::Sell => {
            user_vault.lock_base(params.size)?;
        }
    }

    let clock = Clock::get()?;
    
    order.user = ctx.accounts.user.key();
    order.market = ctx.accounts.market.key();
    order.order_id = params.order_id;
    order.side = params.side;
    order.price = params.price;
    order.size = params.size;
    order.filled = 0;
    order.status = OrderStatus::Pending;
    order.created_at = clock.unix_timestamp;
    order.updated_at = clock.unix_timestamp;
    order.bump = ctx.bumps.order;

    msg!(
        "Order placed: id={}, side={:?}, price={}, size={}",
        order.order_id,
        order.side,
        order.price,
        order.size
    );

    Ok(())
}
