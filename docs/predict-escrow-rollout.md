# Predict Escrow Rollout

This app is currently saving prediction bets in Prisma. To make prediction bets real and fully gasless, move to a no-fee escrow model:

- user funds go into a Starknet escrow contract
- winners are paid from the losing side's collateral
- StarkFlow takes no fee from the pool
- gas sponsorship stays separate from bet collateral

## Contract model

Use one escrow contract funded in USDC.

Each market should track:

- `market_id`
- `base_asset`
- `rule` (`ABOVE` or `BELOW`)
- `start_price`
- `target_price`
- `resolve_at`
- `yes_pool`
- `no_pool`
- `resolved`
- `winning_side`

Each user position should track:

- `market_id`
- `user`
- `yes_amount`
- `no_amount`
- `claimed`

## Payout model

No protocol fee:

```text
total_pool = yes_pool + no_pool

if YES wins:
  user_payout = (user_yes_stake / yes_pool) * total_pool

if NO wins:
  user_payout = (user_no_stake / no_pool) * total_pool
```

That means:

- winners are paid from loser collateral
- the platform treasury does not take a cut
- gas sponsorship must be funded separately

## App fields already prepared

`PredictionBet` now has fields ready for the onchain rollout:

- `executionMode`
- `onchainMarketId`
- `escrowAddress`
- `txHash`
- `claimTxHash`
- `entryProbabilityBps`
- `settlementPrice`
- `payoutAmount`
- `realizedPnl`
- `resolvedAt`
- `claimedAt`

## Env vars to add after deploy

Add these after the escrow contract is deployed:

```env
NEXT_PUBLIC_PREDICT_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_PREDICT_COLLATERAL_TOKEN_ADDRESS=0x...
PREDICT_ESCROW_RESOLVER_ADDRESS=0x...
```

## What still needs to be wired in app code

After deployment, update Predict to:

1. approve USDC to the escrow contract
2. call `place_bet(market_id, side, amount)`
3. save the tx hash and onchain market id
4. resolve markets from the oracle rail
5. let winners call `claim`

## Your part

You need to do these parts outside this repo:

1. Create or add a Starknet Cairo workspace if you do not already have one.
2. Write/deploy the escrow contract on Sepolia first.
3. Choose the USDC contract address that the escrow will accept.
4. Set the three env vars above in `.env.local` and hosting envs.
5. Run:

```powershell
cd C:\Users\USER\starkflow
npx prisma generate
npm run db:push
npm run dev
```

## Recommended rollout order

1. deploy escrow to Sepolia
2. wire `Predict -> place bet`
3. store tx hashes
4. add resolver flow
5. add claim flow
6. expose realized P/L on `Me`
