import * as fs from 'fs';

// All known token information
const TOKEN_INFO: Record<string, { symbol: string; name: string; decimals: number; price?: number }> = {
  'So11111111111111111111111111111111111111112': {
    symbol: 'SOL',
    name: 'Wrapped SOL',
    decimals: 9,
    price: 150
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    price: 1.0
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    price: 1.0
  },
  '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump': {
    symbol: 'Fartcoin',
    name: 'Fartcoin',
    decimals: 6,
    price: 0 // Set manually or fetch from API
  },
  '71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg': {
    symbol: 'GOR',
    name: 'Gorbagana',
    decimals: 6,
    price: 0
  },
  'HXsKnhXPtGr2mq4uTpxbxyy7ZydYWJwx4zMuYPEDukY': {
    symbol: 'DUKY',
    name: 'DukY',
    decimals: 9,
    price: 0
  },
};

async function createFinalData() {
  console.log('=== Creating Final Comprehensive Data ===\n');

  // Load complete pool data
  const poolData = JSON.parse(fs.readFileSync('complete-pool-data.json', 'utf-8'));
  const volumeData = JSON.parse(fs.readFileSync('volume-data.json', 'utf-8'));

  let totalTVL = 0;

  // Process each pool
  const pools = poolData.pools.map((pool: any) => {
    const tokens = pool.tokenAccounts.map((ta: any) => {
      const info = TOKEN_INFO[ta.mint];
      const amount = ta.uiAmount;
      const price = info?.price || 0;
      const value = amount * price;

      return {
        tokenAccount: ta.address,
        mint: ta.mint,
        symbol: info?.symbol || 'UNKNOWN',
        name: info?.name || 'Unknown Token',
        decimals: ta.decimals,
        amount: amount,
        rawAmount: ta.amount,
        price: price,
        value: value,
        owner: ta.owner,
      };
    });

    const poolTVL = tokens.reduce((sum, t) => sum + t.value, 0);
    totalTVL += poolTVL;

    const poolName = tokens.map(t => t.symbol).join('/') || 'Empty Pool';

    return {
      poolAddress: pool.address,
      poolName,
      tvl: poolTVL,
      tokens,
      dataLength: pool.dataLength,
    };
  });

  // Create comprehensive output
  const finalData = {
    metadata: {
      fetchedAt: new Date().toISOString(),
      programId: poolData.programId,
      dataVersion: '1.0.0',
    },
    overview: {
      totalTVL,
      poolCount: pools.length,
      activePoolCount: pools.filter((p: any) => p.tokens.length > 0).length,
      volume24h: volumeData.txCount24h,
      volume7d: volumeData.txCount7d,
      volume30d: volumeData.txCount30d,
      estimatedFees24h: volumeData.txCount24h * 0.003, // 0.3% fee estimate
      estimatedFees7d: volumeData.txCount7d * 0.003,
    },
    tokens: TOKEN_INFO,
    pools,
  };

  // Save final data
  fs.writeFileSync('final-dashboard-data.json', JSON.stringify(finalData, null, 2));

  console.log('=== FINAL DATA SUMMARY ===\n');
  console.log(`Total TVL: $${totalTVL.toLocaleString()}`);
  console.log(`Active Pools: ${finalData.overview.activePoolCount}/${finalData.overview.poolCount}`);
  console.log(`Unique Tokens: ${Object.keys(TOKEN_INFO).length}`);
  console.log(`\nVolume:`);
  console.log(`  24h: ${volumeData.txCount24h} transactions`);
  console.log(`  7d: ${volumeData.txCount7d} transactions`);
  console.log(`  30d: ${volumeData.txCount30d} transactions`);

  console.log('\n=== POOLS BREAKDOWN ===\n');
  pools.forEach((pool: any, i: number) => {
    console.log(`${i + 1}. ${pool.poolName} | TVL: $${pool.tvl.toLocaleString()}`);
    console.log(`   Address: ${pool.poolAddress}`);
    pool.tokens.forEach((token: any) => {
      console.log(`   - ${token.amount.toLocaleString()} ${token.symbol} ($${token.value.toFixed(2)})`);
      console.log(`     Token Account: ${token.tokenAccount}`);
      console.log(`     Mint: ${token.mint}`);
    });
    console.log('');
  });

  console.log('✅ Final data saved to final-dashboard-data.json');
  console.log('\nThis file contains:');
  console.log('  - All pool addresses');
  console.log('  - All token account addresses');
  console.log('  - All token mint addresses');
  console.log('  - Token symbols and names');
  console.log('  - Amounts and values');
  console.log('  - TVL calculations');
  console.log('  - Volume data');

  return finalData;
}

createFinalData().catch(console.error);
