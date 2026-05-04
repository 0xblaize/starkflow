# System Architecture

## System architecture

StarkFlow coordinates user actions, sponsored execution, and settlement on Starknet.

The stack keeps the interface simple while preserving self-custody.

### High-level flow

```
+----------------+          Auth           +-----------------+
|      User      | ----------------------> |      Privy      |
|  Web Interface | <---------------------- | Embedded Wallet |
+----------------+                        +-----------------+

        |
        | Initiates Intent
        V

+----------------+     Signs + Sponsors     +------------------+
|   StarkFlow    | <----------------------> | AVNU Paymaster   |
|   Frontend     |                          | Gas Sponsorship  |
+----------------+                          +------------------+

        |
        | Sponsored Execution
        V

+----------------+--------------------------------------------+
|                    STARKNET BLOCKCHAIN                      |
+----------------+    Settlement Logic     +-----------------+
| Smart Contracts| <---------------------> | Pragma Oracles  |
|   Starkzap v2  |                         |   Price Feeds   |
+----------------+                         +-----------------+

        |
        | Cross-Chain Liquidity
        V

Ethereum ↔ Liquidity Providers ↔ Solana
```

### Execution flow

1. The user authenticates through Privy.
2. The user submits an intent from the StarkFlow interface.
3. AVNU Paymaster sponsors execution.
4. Smart contracts settle the action on Starknet.
5. Pragma supplies oracle data when pricing or settlement needs it.

### Core components

* **Frontend:** Next.js interface for user actions and routing.
* **Wallet and auth:** Privy embedded wallet.
* **Gas sponsorship:** AVNU Paymaster.
* **Contracts:** Starkzap v2 smart contracts on Starknet.
* **Oracle data:** Pragma price feeds.

### Current deployment

The MVP is live on Starknet Sepolia.

Gasless execution, cross-chain flows, and automated execution are functional in testnet.
