# Darklake Dashboard

Personal analytics dashboard for https://darklake.fi/ DEX on Solana.

## Overview

Tracks TVL, volume, fees, pools, and LP positions for the Darklake decentralized exchange.

**Program ID:** `darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1`

## Features

- **Protocol-wide metrics:**
  - Total Value Locked (TVL)
  - 24h/7d/all-time volume
  - Fee revenue (0.5% flat fee)
  - LP count and positions
  - 24h % changes for TVL and volume

- **Per-pool analytics:**
  - TVL, volume, swap counts
  - Fee generation
  - APR (24h fees annualized)
  - Pool prices (from token ratios)
  - LP positions
  - Token balances

- **UI Features:**
  - Terminal-style interface (no frameworks)
  - Real-time data refresh
  - Live price fetching from Jupiter API
  - Snapshot-based % change tracking

## Key Files

### Data Files
- `final-dashboard-data.json` - Main pool and token data
- `fees-data.json` - Fee revenue breakdown
- `snapshot-previous.json` - Previous state for % changes
- `lp-analysis.json` - LP position data

### Scripts
- `scripts/refresh-data.ts` - Main refresh script (~34 RPC calls)
- `scripts/fetch-pools.ts` - Initial pool discovery
- `scripts/identify-tokens.ts` - Token metadata fetching
- `scripts/find-lp-positions.ts` - LP position tracking
- `scripts/extract-fees.ts` - Fee calculation

### UI
- `index.html` - Dashboard interface
- `server.js` - Express server with refresh endpoint

## Setup

```bash
# Install dependencies
pnpm install

# Configure RPC endpoint
echo 'RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY' > .env

# Run initial data collection
pnpm run fetch-pools
pnpm run identify-tokens
pnpm run find-lp-positions
pnpm run extract-fees

# Start server
pnpm run server
```

Server runs on http://localhost:3001

## Usage

**View Dashboard:**
```bash
pnpm run server
# Open http://localhost:3001
```

**Refresh Data:**
- Click "Refresh Data" button in UI, or
- Run manually: `pnpm run refresh`

Refresh fetches:
- Live token prices from Jupiter
- Current pool balances
- Updated swap counts and LP positions
- Recalculates TVL, fees, APR, % changes

## Current Metrics

**Protocol Overview:**
- Total TVL: ~$1.38M
- 24h Volume: ~$17,516
- Total Fees Generated: $693.20 all-time
- Active Pools: 8
- Total LP Positions: 22

**Active Pools:**
1. SOL/USDC - $1.21M TVL, 16 LPs
2. Fartcoin/SOL - $42.2K TVL, 1 LP
3. SOL/USDT - $33.7K TVL, 1 LP
4. wSOL/USDC - $33.2K TVL, 1 LP
5. USDC/USDT - $11.4K TVL, 1 LP
6. GOR/SOL - $39.4K TVL, 1 LP
7. USDS/SOL - $10.9K TVL, 1 LP

## Technical Details

**Fee Calculation:**
- Darklake charges 0.5% flat fee on all trades
- Estimates based on: `swapCount * avgSwapSize * 0.005`
- APR formula: `(24h fees / TVL) * 365 * 100`

**Pool Prices:**
- Calculated from pool token ratios (not external sources)
- Shows both directions (e.g., 1 SOL = X USDC, 1 USDC = X SOL)

**RPC Efficiency:**
- Initial data collection: ~2,600 calls
- Each refresh: ~34 calls (98.7% reduction)
- Helius free tier: 1M calls/month

**% Changes:**
- Tracked via snapshot system
- Compares current state to previous refresh
- Shows 24h changes for TVL and volume

## Dependencies

```json
{
  "@solana/web3.js": "^1.95.8",
  "@solana/spl-token": "^0.4.9",
  "express": "^4.21.2",
  "dotenv": "^16.4.7",
  "typescript": "^5.7.3",
  "tsx": "^4.19.2"
}
```
