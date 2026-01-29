#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

if ! solana slot --url http://127.0.0.1:8899 2>/dev/null; then
  echo "Starting local validator (faucet on 9901 to avoid conflicts)..."
  VALIDATOR_PID=""
  cleanup() {
    if [ -n "$VALIDATOR_PID" ]; then kill "$VALIDATOR_PID" 2>/dev/null || true; fi
  }
  trap cleanup EXIT
  solana-test-validator --reset --faucet-port 9901 &
  VALIDATOR_PID=$!
  sleep 5
  for i in {1..30}; do
    solana slot --url http://127.0.0.1:8899 2>/dev/null && break
    sleep 1
  done
fi

echo "Deploying program..."
solana program deploy target/deploy/dcex.so --url http://127.0.0.1:8899 --keypair target/deploy/dcex-keypair.json || {
  echo "Deploy failed. Program id in lib.rs is 3Y2dNgp8WVLTNptUSUZY48cHCkB5wBRKJmDrC9WJspFo."
  echo "Keypair must match: solana address -k target/deploy/dcex-keypair.json"
  echo "Alternatively run manually: solana-test-validator, then anchor deploy --provider.cluster localnet, then: bun test"
  exit 1
}

echo "Running order tests..."
bun test
