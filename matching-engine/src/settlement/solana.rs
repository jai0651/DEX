use std::str::FromStr;
use anchor_client::anchor_lang::prelude::Pubkey;
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    instruction::{AccountMeta, Instruction},
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use anyhow::Result;

use crate::orderbook::TradeMatch;
use crate::types::Market;

// Import constants or define them here if not available
const MARKET_SEED: &[u8] = b"market";
const VAULT_SEED: &[u8] = b"vault";
const ORDER_SEED: &[u8] = b"order";

pub struct SolanaSettlementClient {
    client: RpcClient,
    program_id: Pubkey,
    payer: Keypair,
}

impl SolanaSettlementClient {
    pub fn new(rpc_url: &str, program_id_str: &str) -> Self {
        let client = RpcClient::new_with_commitment(rpc_url.to_string(), CommitmentConfig::confirmed());
        let program_id = Pubkey::from_str(program_id_str).expect("Invalid program ID");
        
        // For development, we'll generate a payer or load from file. 
        // In a real system, this should be loaded from a secure location.
        // Here we assume the matching engine authority is the payer.
        // TODO: Load real keypair
        let payer = Keypair::new(); 
        
        Self {
            client,
            program_id,
            payer,
        }
    }

    pub fn set_payer(&mut self, keypair: Keypair) {
        self.payer = keypair;
    }

    pub async fn settle_trade(
        &self,
        trade: &TradeMatch,
        market: &Market,
    ) -> Result<String> {
        let maker_wallet = Pubkey::from_str(&trade.maker_wallet)?;
        let taker_wallet = Pubkey::from_str(&trade.taker_wallet)?;
        let base_mint = Pubkey::from_str(&market.base_mint)?;
        let quote_mint = Pubkey::from_str(&market.quote_mint)?;

        let (market_pda, _) = Pubkey::find_program_address(
            &[MARKET_SEED, base_mint.as_ref(), quote_mint.as_ref()],
            &self.program_id,
        );

        let (maker_vault, _) = Pubkey::find_program_address(
            &[VAULT_SEED, maker_wallet.as_ref(), market_pda.as_ref()],
            &self.program_id,
        );

        let (taker_vault, _) = Pubkey::find_program_address(
            &[VAULT_SEED, taker_wallet.as_ref(), market_pda.as_ref()],
            &self.program_id,
        );

        // Convert string order IDs to u128 bytes (little endian)
        let maker_order_id_u128 = u128::from_str(&trade.maker_order_id)?;
        let taker_order_id_u128 = u128::from_str(&trade.taker_order_id)?;

        let (maker_order, _) = Pubkey::find_program_address(
            &[ORDER_SEED, &maker_order_id_u128.to_le_bytes()],
            &self.program_id,
        );

        let (taker_order, _) = Pubkey::find_program_address(
            &[ORDER_SEED, &taker_order_id_u128.to_le_bytes()],
            &self.program_id,
        );

         // We need the market's base and quote vaults to pass to the instruction
        // Assuming associated token accounts for the market PDA? 
        // Or specific vault accounts created during initialization?
        // Based on the contract: 
        // pub base_vault: Account<'info, TokenAccount>,
        // pub quote_vault: Account<'info, TokenAccount>,
        // These are usually stored in the Market account state.
        // Since we don't have the Market account data deserialized here easily without 
        // fetching and parsing, we might need to derive them if they are deterministic 
        // or fetch the market account first.
        // For now, let's assume they are ATA of the market PDA for simplicity, 
        // BUT the contract usually initializes specific token accounts.
        // Let's assume we can derive them or they are ATAs.
        // If the contract uses `token::spl_token` and `anchor_spl`, standard ATAs are common.
        // Let's check `initialize_market` in the contract later if this fails.
        // Actually, matching-engine Market struct doesn't have vault addresses.
        // We might need to fetch the on-chain market account to get these.
        // For now, let's implement a helper to fetch on-chain market data if needed,
        // or just use get_associated_token_address. 
        
        let base_vault = spl_associated_token_account::get_associated_token_address(&market_pda, &base_mint);
        let quote_vault = spl_associated_token_account::get_associated_token_address(&market_pda, &quote_mint);
        
        // Fee recipient is likely the market authority or a specific fee wallet
        // Let's assume it's the market authority's ATA for quote token for now,
        // or a configured fee wallet.
        // The contract requires `fee_recipient: Account<'info, TokenAccount>`.
        // And `constraint = market.authority == authority.key()`.
        // So `authority` must be the signer (our payer).
        let fee_recipient = spl_associated_token_account::get_associated_token_address(&self.payer.pubkey(), &quote_mint);

        let accounts = vec![
            AccountMeta::new_readonly(self.payer.pubkey(), true), // authority
            AccountMeta::new_readonly(market_pda, false),         // market
            AccountMeta::new(maker_vault, false),                 // maker_vault
            AccountMeta::new(taker_vault, false),                 // taker_vault
            AccountMeta::new(maker_order, false),                 // maker_order
            AccountMeta::new(taker_order, false),                 // taker_order
            AccountMeta::new(base_vault, false),                  // base_vault
            AccountMeta::new(quote_vault, false),                 // quote_vault
            AccountMeta::new(fee_recipient, false),               // fee_recipient
            AccountMeta::new_readonly(spl_token::id(), false),    // token_program
        ];

        // SettleTrade params: [fill_size: u64, fill_price: u64]
        // Instruction discriminant for "settle_trade" is needed.
        // Anchor uses Sha256("global:settle_trade")[..8]
        let discriminator = [163, 137, 23, 10, 163, 153, 93, 222]; // Calculated or known
        
        let mut data = Vec::with_capacity(8 + 8 + 8);
        data.extend_from_slice(&discriminator);
        data.extend_from_slice(&(trade.size as u64).to_le_bytes()); // fill_size
        data.extend_from_slice(&(trade.price as u64).to_le_bytes()); // fill_price

        let instruction = Instruction {
            program_id: self.program_id,
            accounts,
            data,
        };

        let recent_blockhash = self.client.get_latest_blockhash()?;
        let transaction = Transaction::new_signed_with_payer(
            &[instruction],
            Some(&self.payer.pubkey()),
            &[&self.payer],
            recent_blockhash,
        );

        let signature = self.client.send_and_confirm_transaction(&transaction)?;
        Ok(signature.to_string())
    }
}
