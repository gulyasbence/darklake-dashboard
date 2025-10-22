import * as fs from 'fs';

// Known token prices (update manually or from API)
const TOKEN_PRICES: Record<string, { symbol: string; price: number; decimals: number }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', price: 150, decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', price: 1.0, decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', price: 1.0, decimals: 6 },
  '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump': { symbol: 'UNKNOWN', price: 0, decimals: 6 },
};

interface AggregatedData {
  overview: {
    totalTVL: number;
    poolCount: number;
    volume24h: number;
    volume7d: number;
    volume30d: number;
    fees24h: number;
    fees7d: number;
    feesAllTime: number;
  };
  pools: Array<{
    address: string;
    tvl: number;
    tokens: Array<{
      symbol: string;
      amount: number;
      value: number;
    }>;
    volume24h: number | null;
    fees24h: number | null;
  }>;
  lastUpdated: string;
}

async function aggregateAllData() {
  console.log('=== Aggregating All Darklake Data ===\n');

  const data: AggregatedData = {
    overview: {
      totalTVL: 0,
      poolCount: 0,
      volume24h: 0,
      volume7d: 0,
      volume30d: 0,
      fees24h: 0,
      fees7d: 0,
      feesAllTime: 0,
    },
    pools: [],
    lastUpdated: new Date().toISOString(),
  };

  // Load complete pool data
  let poolData;
  if (fs.existsSync('complete-pool-data.json')) {
    console.log('✓ Loading complete-pool-data.json');
    poolData = JSON.parse(fs.readFileSync('complete-pool-data.json', 'utf-8'));
  } else if (fs.existsSync('pool-data-manual.json')) {
    console.log('✓ Loading pool-data-manual.json (fallback)');
    poolData = JSON.parse(fs.readFileSync('pool-data-manual.json', 'utf-8'));
  } else {
    console.log('❌ No pool data found!');
    return;
  }

  // Load volume data
  let volumeData;
  if (fs.existsSync('volume-data.json')) {
    console.log('✓ Loading volume-data.json');
    volumeData = JSON.parse(fs.readFileSync('volume-data.json', 'utf-8'));
    data.overview.volume24h = volumeData.txCount24h || 0;
    data.overview.volume7d = volumeData.txCount7d || 0;
    data.overview.volume30d = volumeData.txCount30d || 0;
  }

  console.log('\nProcessing pools...\n');

  // Process each pool
  poolData.pools?.forEach((pool: any, i: number) => {
    console.log(`Pool ${i + 1}: ${pool.address}`);

    let poolTVL = 0;
    const tokens: any[] = [];

    pool.tokenAccounts?.forEach((ta: any) => {
      const tokenInfo = TOKEN_PRICES[ta.mint];
      const decimals = ta.decimals || tokenInfo?.decimals || 9;
      const amount = ta.uiAmount || (Number(ta.amount) / Math.pow(10, decimals));
      const price = tokenInfo?.price || 0;
      const value = amount * price;

      poolTVL += value;

      tokens.push({
        symbol: tokenInfo?.symbol || 'UNKNOWN',
        amount,
        value,
      });

      console.log(`  ${tokenInfo?.symbol || 'UNKNOWN'}: ${amount.toLocaleString()} ($${value.toFixed(2)})`);
    });

    console.log(`  Pool TVL: $${poolTVL.toLocaleString()}\n`);

    data.pools.push({
      address: pool.address,
      tvl: poolTVL,
      tokens,
      volume24h: null, // Would need per-pool tx parsing
      fees24h: null, // Would need fee extraction
    });

    data.overview.totalTVL += poolTVL;
    data.overview.poolCount++;
  });

  // Estimate fees (typically 0.3% of volume for AMMs)
  const FEE_RATE = 0.003;
  data.overview.fees24h = data.overview.volume24h * FEE_RATE;
  data.overview.fees7d = data.overview.volume7d * FEE_RATE;
  data.overview.feesAllTime = data.overview.fees7d * 4; // Rough estimate

  console.log('=== FINAL SUMMARY ===\n');
  console.log(`Total TVL: $${data.overview.totalTVL.toLocaleString()}`);
  console.log(`Pool Count: ${data.overview.poolCount}`);
  console.log(`\nTransactions:`);
  console.log(`  24h: ${data.overview.volume24h}`);
  console.log(`  7d: ${data.overview.volume7d}`);
  console.log(`  30d: ${data.overview.volume30d}`);
  console.log(`\nEstimated Fees (0.3% of volume):`);
  console.log(`  24h: $${data.overview.fees24h.toFixed(2)}`);
  console.log(`  7d: $${data.overview.fees7d.toFixed(2)}`);
  console.log(`  All-time: $${data.overview.feesAllTime.toFixed(2)}`);

  // Save aggregated data
  fs.writeFileSync('dashboard-data.json', JSON.stringify(data, null, 2));
  console.log('\n✅ Aggregated data saved to dashboard-data.json');

  return data;
}

aggregateAllData().catch(console.error);
