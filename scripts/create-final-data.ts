import * as fs from 'fs';

// Token metadata (no hardcoded prices except stablecoins)
const TOKEN_INFO: Record<string, { symbol: string; name: string; decimals: number }> = {
  'So11111111111111111111111111111111111111112': {
    symbol: 'SOL',
    name: 'Wrapped SOL',
    decimals: 9,
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
  '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump': {
    symbol: 'Fartcoin',
    name: 'Fartcoin',
    decimals: 6,
  },
  '71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg': {
    symbol: 'GOR',
    name: 'Gorbagana',
    decimals: 6,
  },
  'HXsKnhXPtGr2mq4uTpxbxyy7ZydYWJwx4zMuYPEDukY': {
    symbol: 'DUKY',
    name: 'DukY',
    decimals: 9,
  },
};

// Derive prices from pool ratios
function derivePricesFromPools(pools: any[]): { [key: string]: number } {
  // Start with stablecoins = $1
  const prices: { [key: string]: number } = {
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // USDT
  };

  // Find SOL/USDC pool to derive SOL price
  const solUsdcPool = pools.find(p =>
    p.tokens.some((t: any) => t.mint === 'So11111111111111111111111111111111111111112') &&
    p.tokens.some((t: any) => t.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  );

  if (solUsdcPool && solUsdcPool.tokens.length === 2) {
    const solToken = solUsdcPool.tokens.find((t: any) => t.mint === 'So11111111111111111111111111111111111111112');
    const usdcToken = solUsdcPool.tokens.find((t: any) => t.mint === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

    if (solToken && usdcToken && solToken.amount > 0) {
      prices['So11111111111111111111111111111111111111112'] = usdcToken.amount / solToken.amount;
    }
  }

  // For any other tokens in pools, try to derive from their pairs
  for (const pool of pools) {
    if (pool.tokens.length === 2) {
      const [token0, token1] = pool.tokens;

      // If we know one token's price, derive the other
      if (prices[token0.mint] && !prices[token1.mint] && token1.amount > 0) {
        prices[token1.mint] = (token0.amount * prices[token0.mint]) / token1.amount;
      } else if (prices[token1.mint] && !prices[token0.mint] && token0.amount > 0) {
        prices[token0.mint] = (token1.amount * prices[token1.mint]) / token0.amount;
      }
    }
  }

  return prices;
}

async function createFinalData() {
  console.log('=== Creating Final Comprehensive Data ===\n');

  // Load complete pool data
  const poolData = JSON.parse(fs.readFileSync('complete-pool-data.json', 'utf-8'));

  let totalTVL = 0;

  // First pass: build pool structure with token amounts (no prices yet)
  const poolsWithBalances = poolData.pools.map((pool: any) => {
    const tokens = pool.tokenAccounts.map((ta: any) => {
      const info = TOKEN_INFO[ta.mint];
      const amount = ta.uiAmount;

      return {
        tokenAccount: ta.address,
        mint: ta.mint,
        symbol: info?.symbol || 'UNKNOWN',
        name: info?.name || 'Unknown Token',
        decimals: ta.decimals,
        amount: amount,
        rawAmount: ta.amount,
        owner: ta.owner,
      };
    });

    const poolName = tokens.map(t => t.symbol).join('/') || 'Empty Pool';

    return {
      poolAddress: pool.address,
      poolName,
      tokens,
      dataLength: pool.dataLength,
    };
  });

  // Derive prices from pool ratios
  console.log('Deriving prices from pool ratios...\n');
  const prices = derivePricesFromPools(poolsWithBalances);

  // Second pass: calculate TVL with derived prices
  const pools = poolsWithBalances.map((pool: any) => {
    const tokensWithPrices = pool.tokens.map((token: any) => {
      const price = prices[token.mint] || 0;
      const value = token.amount * price;

      return {
        ...token,
        price,
        value,
      };
    });

    const poolTVL = tokensWithPrices.reduce((sum: number, t: any) => sum + t.value, 0);
    totalTVL += poolTVL;

    return {
      ...pool,
      tvl: poolTVL,
      tokens: tokensWithPrices,
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
      activePoolCount: pools.filter((p: any) => p.tvl > 0).length,
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

  console.log(`\nDerived Prices:`);
  Object.entries(prices).forEach(([mint, price]) => {
    const info = TOKEN_INFO[mint];
    if (info) {
      console.log(`  ${info.symbol}: $${price.toFixed(6)}`);
    }
  });

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
  console.log('  - TVL calculations based on pool-derived prices');

  return finalData;
}

createFinalData().catch(console.error);
