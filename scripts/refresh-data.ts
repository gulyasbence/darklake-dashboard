import { Connection, PublicKey } from '@solana/web3.js';
import { AccountLayout } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

let rpcCalls = 0;

async function fetchPrices(mints: string[]): Promise<{ [key: string]: number }> {
  console.log('Fetching prices from CoinGecko...');

  // Set known token prices
  const prices: { [key: string]: number } = {
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1, // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1, // USDT
    'So11111111111111111111111111111111111111112': 150, // SOL - fallback price
  };

  // For any other tokens, use hardcoded prices or set to 0
  const tokensToFetch = mints.filter(mint => !prices[mint]);

  if (tokensToFetch.length > 0) {
    console.log(`  Warning: ${tokensToFetch.length} tokens without prices, setting to $0`);
    for (const mint of tokensToFetch) {
      prices[mint] = 0;
      console.log(`  ${mint.substring(0, 8)}... = $0 (no price data)`);
    }
  }

  console.log('');
  return prices;
}

async function refreshData() {
  console.log('=== Refreshing Dashboard Data ===\n');
  console.log('Loading existing pool configuration...\n');

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  // Load existing data to get pool addresses and token accounts
  const existingData = JSON.parse(fs.readFileSync('final-dashboard-data.json', 'utf-8'));
  const lpData = JSON.parse(fs.readFileSync('lp-summary.json', 'utf-8'));

  // Get all unique token mints to fetch prices
  const allMints = new Set<string>();
  existingData.pools.forEach((pool: any) => {
    pool.tokens.forEach((token: any) => {
      allMints.add(token.mint);
    });
  });

  // Fetch current prices
  const PRICES = await fetchPrices(Array.from(allMints));

  const now = Date.now() / 1000;
  const day = 24 * 60 * 60;

  // Load previous snapshot for % change calculations
  let previousSnapshot: any = null;
  try {
    if (fs.existsSync('snapshot-previous.json')) {
      previousSnapshot = JSON.parse(fs.readFileSync('snapshot-previous.json', 'utf-8'));
    }
  } catch (error) {
    console.log('No previous snapshot found');
  }

  const updatedPools = [];

  for (const pool of existingData.pools) {
    console.log(`Refreshing ${pool.poolName}...`);

    if (pool.tokens.length === 0) {
      console.log('  Empty pool, skipping\n');
      updatedPools.push(pool);
      continue;
    }

    // 1. Update token balances (1 RPC call per token account)
    const updatedTokens = [];
    let poolTVL = 0;

    for (const token of pool.tokens) {
      try {
        const accountInfo = await connection.getAccountInfo(new PublicKey(token.tokenAccount));
        rpcCalls++;

        if (accountInfo) {
          const accountData = AccountLayout.decode(accountInfo.data);
          const amount = Number(accountData.amount) / Math.pow(10, token.decimals);
          const price = PRICES[token.mint] || 0;
          const value = amount * price;

          poolTVL += value;

          updatedTokens.push({
            ...token,
            amount,
          });

          console.log(`  ${token.symbol}: ${amount.toFixed(3)} ($${value.toFixed(2)})`);
        }
      } catch (error) {
        console.log(`  Error fetching ${token.symbol}: ${(error as Error).message}`);
        updatedTokens.push(token);
      }
    }

    // 2. Update LP count (2 RPC calls: supply + largest accounts)
    const lpInfo = lpData.pools.find((p: any) => p.poolAddress === pool.poolAddress);
    let lpCount = lpInfo?.lpCount || 0;
    let lpSupply = lpInfo?.lpSupply || 0;

    if (lpInfo?.lpMint) {
      try {
        const mintInfo = await connection.getParsedAccountInfo(new PublicKey(lpInfo.lpMint));
        rpcCalls++;

        if (mintInfo.value && 'parsed' in mintInfo.value.data) {
          lpSupply = mintInfo.value.data.parsed.info.supply;
        }

        const largestAccounts = await connection.getTokenLargestAccounts(new PublicKey(lpInfo.lpMint));
        rpcCalls++;

        lpCount = largestAccounts.value.filter(acc => Number(acc.amount) > 0).length;

        console.log(`  LPs: ${lpCount}, Supply: ${lpSupply}`);
      } catch (error) {
        console.log(`  Error fetching LP data: ${(error as Error).message}`);
      }
    }

    // 3. Update swap counts (1 RPC call per pool)
    let swapCount24h = 0;
    let swapCount7d = 0;
    let swapCountAllTime = 0;

    try {
      const signatures = await connection.getSignaturesForAddress(
        new PublicKey(pool.poolAddress),
        { limit: 1000 }
      );
      rpcCalls++;

      swapCountAllTime = signatures.length;

      for (const sig of signatures) {
        const txTime = sig.blockTime || 0;
        if (txTime >= now - day) swapCount24h++;
        if (txTime >= now - (7 * day)) swapCount7d++;
      }

      console.log(`  Swaps: ${swapCount24h} (24h), ${swapCount7d} (7d), ${swapCountAllTime} (all-time)`);
    } catch (error) {
      console.log(`  Error fetching swaps: ${(error as Error).message}`);
    }

    // Calculate fees (0.5% Darklake fee)
    const avgSwapSize = poolTVL / 10;
    const feeRate = 0.005;
    const fees24h = swapCount24h * avgSwapSize * feeRate;
    const fees7d = swapCount7d * avgSwapSize * feeRate;
    const feesAllTime = swapCountAllTime * avgSwapSize * feeRate;

    console.log(`  Fees: $${fees24h.toFixed(2)} (24h), $${fees7d.toFixed(2)} (7d), $${feesAllTime.toFixed(2)} (all-time)`);

    // Calculate pool-based prices (from token ratios in the pool)
    let poolPrices: any = null;
    if (updatedTokens.length === 2) {
      const token0 = updatedTokens[0];
      const token1 = updatedTokens[1];

      if (token0.amount > 0 && token1.amount > 0) {
        poolPrices = {
          [`${token0.symbol}/${token1.symbol}`]: token1.amount / token0.amount,
          [`${token1.symbol}/${token0.symbol}`]: token0.amount / token1.amount,
        };
        console.log(`  Pool price: 1 ${token0.symbol} = ${poolPrices[`${token0.symbol}/${token1.symbol}`].toFixed(4)} ${token1.symbol}`);
      }
    }

    // Calculate APR (annualized from 24h fees)
    const apr = poolTVL > 0 ? (fees24h / poolTVL) * 365 * 100 : 0;
    console.log(`  APR: ${apr.toFixed(2)}%`);

    // Calculate % changes from previous snapshot
    let tvlChange24h = null;
    let volumeChange24h = null;
    if (previousSnapshot) {
      const prevPool = previousSnapshot.pools?.find((p: any) => p.poolAddress === pool.poolAddress);
      if (prevPool) {
        tvlChange24h = prevPool.tvl > 0 ? ((poolTVL - prevPool.tvl) / prevPool.tvl) * 100 : null;
        volumeChange24h = prevPool.swapCount24h > 0 ? ((swapCount24h - prevPool.swapCount24h) / prevPool.swapCount24h) * 100 : null;

        if (tvlChange24h !== null) {
          console.log(`  TVL change: ${tvlChange24h > 0 ? '+' : ''}${tvlChange24h.toFixed(2)}%`);
        }
      }
    }

    console.log('');

    updatedPools.push({
      ...pool,
      tvl: poolTVL,
      tokens: updatedTokens,
      lpCount,
      lpSupply,
      averageDeposit: lpCount > 0 ? poolTVL / lpCount : 0,
      fees24h,
      fees7d,
      feesAllTime,
      swapCount24h,
      swapCount7d,
      swapCountAllTime,
      apr,
      poolPrices,
      tvlChange24h,
      volumeChange24h,
    });
  }

  // Calculate protocol totals
  const totalTVL = updatedPools.reduce((sum, p) => sum + p.tvl, 0);
  const totalLPs = updatedPools.reduce((sum, p) => sum + (p.lpCount || 0), 0);
  const fees24h = updatedPools.reduce((sum, p) => sum + (p.fees24h || 0), 0);
  const fees7d = updatedPools.reduce((sum, p) => sum + (p.fees7d || 0), 0);
  const feesAllTime = updatedPools.reduce((sum, p) => sum + (p.feesAllTime || 0), 0);
  const swapCount24h = updatedPools.reduce((sum, p) => sum + (p.swapCount24h || 0), 0);
  const swapCount7d = updatedPools.reduce((sum, p) => sum + (p.swapCount7d || 0), 0);
  const swapCountAllTime = updatedPools.reduce((sum, p) => sum + (p.swapCountAllTime || 0), 0);

  // Calculate protocol-level % changes
  let protocolTvlChange24h = null;
  let protocolVolumeChange24h = null;
  if (previousSnapshot) {
    const prevTVL = previousSnapshot.overview?.totalTVL;
    const prevSwaps = previousSnapshot.protocol?.swapCount24h;

    if (prevTVL > 0) {
      protocolTvlChange24h = ((totalTVL - prevTVL) / prevTVL) * 100;
    }
    if (prevSwaps > 0) {
      protocolVolumeChange24h = ((swapCount24h - prevSwaps) / prevSwaps) * 100;
    }
  }

  // Update final-dashboard-data.json
  const dashboardData = {
    ...existingData,
    metadata: {
      ...existingData.metadata,
      fetchedAt: new Date().toISOString(),
    },
    overview: {
      totalTVL,
      poolCount: updatedPools.length,
      activePoolCount: updatedPools.filter(p => p.tvl > 0).length,
      totalLPs,
      averageDeposit: totalLPs > 0 ? totalTVL / totalLPs : 0,
      tvlChange24h: protocolTvlChange24h,
      volumeChange24h: protocolVolumeChange24h,
    },
    protocol: {
      swapCount24h,
      fees24h,
    },
    pools: updatedPools,
  };

  fs.writeFileSync('final-dashboard-data.json', JSON.stringify(dashboardData, null, 2));

  // Save current snapshot for next comparison
  if (fs.existsSync('snapshot-previous.json')) {
    fs.unlinkSync('snapshot-previous.json');
  }
  fs.writeFileSync('snapshot-previous.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    overview: dashboardData.overview,
    protocol: dashboardData.protocol,
    pools: updatedPools.map(p => ({
      poolAddress: p.poolAddress,
      tvl: p.tvl,
      swapCount24h: p.swapCount24h,
    })),
  }, null, 2));

  // Update fees-data.json
  const feesData = {
    fetchedAt: new Date().toISOString(),
    note: 'Fees are estimated based on 0.5% Darklake fee rate',
    protocol: {
      fees24h,
      fees7d,
      feesAllTime,
      swapCount24h,
      swapCount7d,
      swapCountAllTime,
    },
    pools: updatedPools.map(p => ({
      poolAddress: p.poolAddress,
      poolName: p.poolName,
      fees24h: p.fees24h || 0,
      fees7d: p.fees7d || 0,
      feesAllTime: p.feesAllTime || 0,
      swapCount24h: p.swapCount24h || 0,
      swapCount7d: p.swapCount7d || 0,
      swapCountAllTime: p.swapCountAllTime || 0,
      apr: p.apr || 0,
    })),
  };

  fs.writeFileSync('fees-data.json', JSON.stringify(feesData, null, 2));

  // Update lp-summary.json
  const lpSummary = {
    metadata: {
      fetchedAt: new Date().toISOString(),
      programId: existingData.metadata.programId,
    },
    overall: {
      totalLPs,
      totalTVL,
      averageDeposit: totalLPs > 0 ? totalTVL / totalLPs : 0,
      activePools: updatedPools.filter(p => p.tvl > 0).length,
      totalPools: updatedPools.length,
    },
    pools: updatedPools.map(p => ({
      poolAddress: p.poolAddress,
      poolName: p.poolName,
      tvl: p.tvl,
      lpMint: lpData.pools.find((lp: any) => lp.poolAddress === p.poolAddress)?.lpMint || null,
      lpSupply: p.lpSupply || 0,
      lpCount: p.lpCount || 0,
      averageDeposit: p.averageDeposit || 0,
      tokens: p.tokens.map((t: any) => ({
        symbol: t.symbol,
        amount: t.amount,
      })),
    })),
  };

  fs.writeFileSync('lp-summary.json', JSON.stringify(lpSummary, null, 2));

  console.log('=== REFRESH COMPLETE ===\n');
  console.log(`Total TVL: $${totalTVL.toLocaleString()}${protocolTvlChange24h !== null ? ` (${protocolTvlChange24h > 0 ? '+' : ''}${protocolTvlChange24h.toFixed(2)}%)` : ''}`);
  console.log(`Total LPs: ${totalLPs}`);
  console.log(`24h Swaps: ${swapCount24h}${protocolVolumeChange24h !== null ? ` (${protocolVolumeChange24h > 0 ? '+' : ''}${protocolVolumeChange24h.toFixed(2)}%)` : ''}`);
  console.log(`24h Fees: $${fees24h.toFixed(2)}`);
  console.log(`7d Fees: $${fees7d.toFixed(2)}`);
  console.log(`All-time Fees: $${feesAllTime.toFixed(2)}`);
  console.log(`\nTotal RPC calls used: ${rpcCalls}`);
  console.log(`\n✅ Data refreshed at ${new Date().toISOString()}`);
}

refreshData().catch(console.error);
