# Cross-Chain Bridge

## Cross-chain bridge

StarkFlow wraps bridging into the same execution flow as swaps and automation.

Users do not need to piece together separate tools for multichain movement.

### Current scope

The current architecture connects Starknet with Ethereum and Solana through liquidity routing.

### How routing works

1. The user selects the source and destination flow.
2. StarkFlow routes liquidity through bridge and provider paths.
3. Settlement completes with Starknet as the coordination layer.

### Why it matters

* Fewer manual steps.
* Less context switching.
* Simpler multichain execution.
