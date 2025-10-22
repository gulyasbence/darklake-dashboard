# Darklake Data Summary

## Current Data Available

### TVL (Total Value Locked)
- **Total TVL**: $1,405.12 (from 3 pools - partial data)
- **Number of Pools**: 3 analyzed (8 total found)
- **Average Pool TVL**: $468.37

### Pool Breakdown

#### Pool 1: `2FwaRpni7rhHMQpfihTjpZ5SadwpnTNZzEBSzMPgVSTd`
- **TVL**: $13.88
- **Tokens**:
  - 0.092 SOL (~$13.75)
  - 0.129 USDC (~$0.13)

#### Pool 2: `2W28tZr2Qwy2PqnesqUzbxB2S4E7BTisoJTjAhtVamxB`
- **TVL**: $5.12
- **Tokens**:
  - 0.016 SOL (~$2.46)
  - 2.665 USDT (~$2.67)

#### Pool 3: `4QFDY2LCRF5Kqyfp78V86TjLfYK4kcmn4A3XbEH1TfRn`
- **TVL**: $1,386.11
- **Tokens**:
  - 3,320.03 Unknown Token (needs identification)
  - 1,386.11 USDC

## Data Files

- `pool-data-manual.json` - Raw pool and token account data
- `tvl-data.json` - Calculated TVL with prices

## Scripts Available

```bash
# Fetch all pool accounts from Darklake program
pnpm run fetch-pools

# Calculate TVL from pool data
pnpm run calculate-tvl
```

## What's Missing

### For Complete Dashboard

1. **Volume Data**
   - Need to fetch transaction history for pools
   - Calculate 24h, 7d, 30d volume
   - Parse swap transactions

2. **Fees Data**
   - Extract fee information from pool accounts
   - Calculate fees generated (24h, 7d, all-time)

3. **All Pools**
   - Currently have data for 3/8 pools
   - Need to complete scanning all 8 pools for token accounts

4. **Token Metadata**
   - Identify unknown tokens
   - Fetch token names, symbols, logos

5. **Real-time Prices**
   - Currently using hardcoded prices
   - Need to integrate Jupiter or CoinGecko API
   - SOL price: $150 (hardcoded)
   - Stablecoins: $1.00 (hardcoded)

## Next Steps

### Data Collection (Priority)
1. Complete pool scanning for all 8 pools
2. Set up price API integration (Jupiter/CoinGecko)
3. Fetch transaction history for volume calculation
4. Identify unknown tokens via metadata

### UI Development
1. Create dashboard layout
2. Display TVL card
3. Display volume with timeframe selector
4. Display fees generated
5. Display pools table with stats

### Real-time Updates
1. Set up periodic data refresh
2. Cache data to avoid rate limits
3. Add loading states

## Technical Notes

- Program ID: `darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1`
- 8 pool accounts found on Solana mainnet
- Token accounts are embedded in pool account data (not at standard offsets)
- RPC rate limiting is a challenge - need paid RPC for full data fetching
- Helius free tier API key configured
