use anyhow::Result;

#[derive(Clone)]
pub struct Config {
    pub server_addr: String,
    pub database_url: String,
    pub redis_url: String,
    pub solana_rpc_url: String,
    pub program_id: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            server_addr: std::env::var("SERVER_ADDR").unwrap_or_else(|_| "0.0.0.0:3001".to_string()),
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://localhost/dcex".to_string()),
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
            solana_rpc_url: std::env::var("SOLANA_RPC_URL")
                .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string()),
            program_id: std::env::var("PROGRAM_ID")
                .unwrap_or_else(|_| "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS".to_string()),
        })
    }
}
