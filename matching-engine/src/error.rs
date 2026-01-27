use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Invalid order: {0}")]
    InvalidOrder(String),
    
    #[error("Order not found")]
    OrderNotFound,
    
    #[error("Market not found")]
    MarketNotFound,
    
    #[error("Insufficient balance")]
    InsufficientBalance,
    
    #[error("Unauthorized")]
    Unauthorized,
    
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),
    
    #[error("Internal server error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::InvalidOrder(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::OrderNotFound => (StatusCode::NOT_FOUND, "Order not found".to_string()),
            AppError::MarketNotFound => (StatusCode::NOT_FOUND, "Market not found".to_string()),
            AppError::InsufficientBalance => (StatusCode::BAD_REQUEST, "Insufficient balance".to_string()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Unauthorized".to_string()),
            AppError::Database(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)),
            AppError::Redis(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Redis error: {}", e)),
            AppError::Internal(e) => (StatusCode::INTERNAL_SERVER_ERROR, format!("Internal error: {}", e)),
        };

        let body = Json(json!({
            "error": message
        }));

        (status, body).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
