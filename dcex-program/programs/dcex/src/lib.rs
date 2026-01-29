use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("3Y2dNgp8WVLTNptUSUZY48cHCkB5wBRKJmDrC9WJspFo");

#[program]
pub mod dcex {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        params: InitializeMarketParams,
    ) -> Result<()> {
        instructions::initialize_market::handler(ctx, params)
    }

    pub fn deposit(ctx: Context<Deposit>, params: DepositParams) -> Result<()> {
        instructions::deposit::handler(ctx, params)
    }

    pub fn withdraw(ctx: Context<Withdraw>, params: WithdrawParams) -> Result<()> {
        instructions::withdraw::handler(ctx, params)
    }

    pub fn place_order(ctx: Context<PlaceOrder>, params: PlaceOrderParams) -> Result<()> {
        instructions::place_order::handler(ctx, params)
    }

    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        instructions::cancel_order::handler(ctx)
    }

    pub fn settle_trade(ctx: Context<SettleTrade>, params: SettleTradeParams) -> Result<()> {
        instructions::settle_trade::handler(ctx, params)
    }
}
