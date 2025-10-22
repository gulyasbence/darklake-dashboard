# Building Darklake Dashboard on Dune

## Problem

Dune doesn't natively parse Darklake's custom Solana program data. You'd need to:
- Decode the 289-byte pool account structure
- Map token accounts embedded in pool data
- Parse custom swap instructions

**This is complex!** Your current approach (fetching via RPC) works better.

## Solution: Hybrid Approach

### Architecture

```
Your Scripts (RPC) → Fetch Data → Upload to Dune → Build Dashboards
```

### Step 1: Continue Using Your Scripts

You already have working scripts that fetch:
- Pool data from Solana
- Token balances
- Transaction counts
- TVL calculations

**Keep using these!** They work perfectly.

### Step 2: Create Dune Query Upload Script

Transform your data into SQL INSERT statements for Dune:

```typescript
// scripts/upload-to-dune.ts
import * as fs from 'fs';

async function uploadToDune() {
  const data = JSON.parse(fs.readFileSync('dashboard-data.json', 'utf-8'));

  // Create SQL for Dune
  const sql = `
  CREATE TABLE IF NOT EXISTS darklake_metrics (
    metric_date TIMESTAMP,
    total_tvl DECIMAL,
    pool_count INTEGER,
    volume_24h INTEGER,
    fees_24h DECIMAL
  );

  INSERT INTO darklake_metrics VALUES (
    TIMESTAMP '${data.lastUpdated}',
    ${data.overview.totalTVL},
    ${data.overview.poolCount},
    ${data.overview.volume24h},
    ${data.overview.fees24h}
  );
  `;

  // Upload to Dune API (requires Dune API key)
  // https://docs.dune.com/api-reference/tables/endpoint/create
}
```

### Step 3: Use Dune API to Upload

```bash
# Set your Dune API key
export DUNE_API_KEY="your_key_here"

# Upload data
curl -X POST https://api.dune.com/api/v1/table/upload/csv \
  -H "X-DUNE-API-KEY: $DUNE_API_KEY" \
  -H "Content-Type: application/json" \
  -d @dashboard-data.json
```

### Step 4: Query in Dune

Once uploaded, create queries like:

```sql
-- Darklake TVL Over Time
SELECT
    metric_date,
    total_tvl,
    pool_count
FROM darklake_metrics
ORDER BY metric_date DESC
LIMIT 30
```

```sql
-- Volume Trends
SELECT
    DATE_TRUNC('day', metric_date) as day,
    AVG(volume_24h) as avg_volume,
    AVG(fees_24h) as avg_fees
FROM darklake_metrics
GROUP BY 1
ORDER BY 1 DESC
```

## Alternative: Pure Dune Approach

If you want **everything on Dune**, you'd need to:

### 1. Decode Program Accounts

Create a Dune Spell to decode Darklake's account structure:

```sql
-- This requires knowing the exact byte layout
WITH pool_accounts AS (
  SELECT
    account_key,
    data,
    -- Decode byte 0-8 as discriminator
    BYTEARRAY_SUBSTRING(data, 0, 8) as discriminator,
    -- Decode byte 136-168 as token account 1
    BYTEARRAY_SUBSTRING(data, 136, 32) as token_account_1,
    -- Decode byte 168-200 as token account 2
    BYTEARRAY_SUBSTRING(data, 168, 32) as token_account_2
  FROM solana.account_activity
  WHERE account_key IN (
    '2FwaRpni7rhHMQpfihTjpZ5SadwpnTNZzEBSzMPgVSTd',
    -- ... all 8 pool addresses
  )
)
SELECT * FROM pool_accounts
```

**Problem**: You'd need to know:
- Exact byte offsets for each field
- How to decode Rust structs
- Account state changes over time

### 2. Get Token Balances

```sql
-- Query token account balances
SELECT
    t.token_account,
    t.mint_address,
    t.owner,
    t.amount / POW(10, tm.decimals) as ui_amount
FROM solana.spl_token_balances t
JOIN solana.token_mints tm ON t.mint_address = tm.address
WHERE t.token_account IN (
    '4EmzN3TcakMLQQttkD7dduNSXrayMuZ19FBS54nvpniP',
    'EJb1XPhittpN6EoqeiEQYys9sdzk3dDMdzWuLf2CEjkJ',
    -- ... all token accounts from your pools
)
```

### 3. Calculate TVL

```sql
-- Combine token balances with prices
WITH token_values AS (
  SELECT
    t.token_account,
    t.amount / POW(10, tm.decimals) as amount,
    p.price,
    (t.amount / POW(10, tm.decimals)) * p.price as value
  FROM solana.spl_token_balances t
  JOIN solana.token_mints tm ON t.mint_address = tm.address
  JOIN prices.usd p ON tm.address = p.contract_address
  WHERE p.blockchain = 'solana'
)
SELECT SUM(value) as total_tvl
FROM token_values
```

## Recommendation

### For Quick Dashboard: Use Your Current Setup

**Pros:**
- ✅ Already working
- ✅ Easier to maintain
- ✅ More control over data
- ✅ Can fetch custom program data

**Build your dashboard with:**
- Next.js (you have the project ready)
- Vercel for hosting (free)
- `dashboard-data.json` as data source

### For Dune Dashboard: Hybrid Approach

**Best of both worlds:**
1. Fetch data with your scripts (daily/hourly)
2. Upload to Dune via API
3. Build visualizations on Dune
4. Share public dashboard link

### Steps for Hybrid:

```bash
# 1. Create Dune account (free)
# https://dune.com/

# 2. Get API key
# https://dune.com/settings/api

# 3. Create upload script
pnpm add node-fetch

# 4. Schedule uploads (cron)
# Upload fresh data every hour
```

## Comparison

| Feature | Your Setup | Pure Dune | Hybrid |
|---------|-----------|-----------|--------|
| Custom program data | ✅ Easy | ❌ Hard | ✅ Easy |
| Real-time updates | ✅ Fast | ⚠️ Delayed | ⚠️ Delayed |
| Public sharing | ⚠️ Need hosting | ✅ Built-in | ✅ Built-in |
| Maintenance | ⚠️ Your scripts | ✅ Dune handles | ⚠️ Both |
| Cost | Free | Free tier | Free tier |
| Customization | ✅ Full control | ⚠️ SQL only | ✅ Full control |

## My Recommendation

**Start with your Next.js dashboard**, then add Dune later if you want:
- Public sharing
- Historical data visualization
- Community-facing analytics

**Why?**
1. You already have working data fetching
2. Darklake's custom program is easier to parse in TypeScript than SQL
3. You can deploy to Vercel for free
4. Full control over UI/UX

**Then add Dune** for public analytics:
1. Upload daily snapshots via API
2. Build trend charts on Dune
3. Share public dashboard link
4. Keep real-time dashboard on your site

Want me to help build the Next.js UI now, or create the Dune upload script?
