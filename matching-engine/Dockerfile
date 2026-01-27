FROM rust:1.75-slim-bookworm as builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src

COPY src ./src
COPY migrations ./migrations

RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates libssl3 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/matching-engine /usr/local/bin/
COPY --from=builder /app/migrations /app/migrations

WORKDIR /app

ENV RUST_LOG=matching_engine=info,tower_http=info

EXPOSE 3001

CMD ["matching-engine"]
