use std::sync::Arc;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};

use crate::types::WsMessage;
use crate::AppState;

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    
    let (client_id, mut ws_rx) = state.ws_manager.add_client().await;
    
    tracing::info!("WebSocket client connected: {}", client_id);

    let send_task = tokio::spawn(async move {
        while let Some(msg) = ws_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    let state_clone = state.clone();
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                        handle_client_message(&state_clone, client_id, ws_msg).await;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    state.ws_manager.remove_client(client_id).await;
    tracing::info!("WebSocket client disconnected: {}", client_id);
}

async fn handle_client_message(state: &Arc<AppState>, client_id: u64, msg: WsMessage) {
    match msg {
        WsMessage::Subscribe { market_id } => {
            state.ws_manager.subscribe(client_id, market_id).await;
            
            let orderbook_manager = state.orderbook_manager.read().await;
            if let Some(orderbook) = orderbook_manager.get(&market_id) {
                let snapshot = orderbook.snapshot(20);
                state.ws_manager.send_to_client(
                    client_id,
                    WsMessage::OrderbookSnapshot(snapshot),
                ).await;
            }
            
            tracing::debug!("Client {} subscribed to market {}", client_id, market_id);
        }
        WsMessage::Unsubscribe { market_id } => {
            state.ws_manager.unsubscribe(client_id, market_id).await;
            tracing::debug!("Client {} unsubscribed from market {}", client_id, market_id);
        }
        _ => {}
    }
}
