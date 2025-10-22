import { Connection, PublicKey, ParsedInstruction } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const DARKLAKE_PROGRAM_ID = 'darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractFees() {
  console.log('=== Extracting Fee Data ===\n');

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const poolData = JSON.parse(fs.readFileSync('final-dashboard-data.json', 'utf-8'));

  console.log('Strategy 1: Checking pool account data for fee fields...\n');

  // Reload raw pool data to check for fee info
  const rawPoolData = JSON.parse(fs.readFileSync('complete-pool-data.json', 'utf-8'));

  rawPoolData.pools.forEach((pool: any, i: number) => {
    const poolInfo = poolData.pools[i];
    console.log(`Pool ${i + 1}: ${poolInfo.poolName}`);
    console.log(`  Data length: ${pool.dataLength} bytes`);

    // Pool accounts are 289 or 186 bytes
    // Fees might be stored as u64 (8 bytes) somewhere in the account
    console.log('  (Fee data would need to be decoded from the 289-byte structure)');
    console.log('');
  });

  console.log('\nStrategy 2: Analyzing swap transactions for fee collection...\n');

  const poolFees: any[] = [];
  const now = Date.now() / 1000;
  const day = 24 * 60 * 60;

  for (let i = 0; i < poolData.pools.length; i++) {
    const pool = poolData.pools[i];

    if (pool.tokens.length === 0) {
      console.log(`${pool.poolName}: Skipping (empty pool)`);
      poolFees.push({
        poolAddress: pool.poolAddress,
        poolName: pool.poolName,
        fees24h: 0,
        fees7d: 0,
        feesAllTime: 0,
        swapCount24h: 0,
        swapCount7d: 0,
        swapCountAllTime: 0,
      });
      continue;
    }

    console.log(`\nAnalyzing ${pool.poolName}...`);

    try {
      await sleep(300);

      // Get transaction signatures
      const signatures = await connection.getSignaturesForAddress(
        new PublicKey(pool.poolAddress),
        { limit: 1000 }
      );

      console.log(`  Found ${signatures.length} transactions`);

      let swapCount24h = 0;
      let swapCount7d = 0;
      let swapCountAllTime = signatures.length;
      let totalFeesEstimated = 0;

      // Count swaps by timeframe
      for (const sig of signatures) {
        const txTime = sig.blockTime || 0;

        if (txTime >= now - day) swapCount24h++;
        if (txTime >= now - (7 * day)) swapCount7d++;
      }

      // Darklake charges a flat 0.5% fee on trading volume
      // Without parsing individual swap amounts, we can't calculate exact fees
      // So we'll use pool TVL and swap count as a proxy

      const avgSwapSize = pool.tvl / 10; // Very rough estimate
      const feeRate = 0.005; // 0.5% Darklake fee

      const fees24h = swapCount24h * avgSwapSize * feeRate;
      const fees7d = swapCount7d * avgSwapSize * feeRate;
      const feesAllTime = swapCountAllTime * avgSwapSize * feeRate;

      console.log(`  Swaps: ${swapCount24h} (24h), ${swapCount7d} (7d), ${swapCountAllTime} (all-time)`);
      console.log(`  Estimated fees: $${fees24h.toFixed(2)} (24h), $${fees7d.toFixed(2)} (7d), $${feesAllTime.toFixed(2)} (all-time)`);

      poolFees.push({
        poolAddress: pool.poolAddress,
        poolName: pool.poolName,
        fees24h,
        fees7d,
        feesAllTime,
        swapCount24h,
        swapCount7d,
        swapCountAllTime,
        note: 'Fees are estimated based on swap count and pool TVL. Actual fees require parsing individual swap transactions.',
      });

    } catch (error) {
      console.log(`  Error: ${(error as Error).message}`);
      poolFees.push({
        poolAddress: pool.poolAddress,
        poolName: pool.poolName,
        fees24h: 0,
        fees7d: 0,
        feesAllTime: 0,
        swapCount24h: 0,
        swapCount7d: 0,
        swapCountAllTime: 0,
      });
    }
  }

  // Calculate overall protocol fees
  const protocolFees = {
    fees24h: poolFees.reduce((sum, p) => sum + p.fees24h, 0),
    fees7d: poolFees.reduce((sum, p) => sum + p.fees7d, 0),
    feesAllTime: poolFees.reduce((sum, p) => sum + p.feesAllTime, 0),
    swapCount24h: poolFees.reduce((sum, p) => sum + p.swapCount24h, 0),
    swapCount7d: poolFees.reduce((sum, p) => sum + p.swapCount7d, 0),
    swapCountAllTime: poolFees.reduce((sum, p) => sum + p.swapCountAllTime, 0),
  };

  const output = {
    fetchedAt: new Date().toISOString(),
    note: 'Fees are estimated. For exact fees, we need to: 1) Decode fee data from pool accounts, 2) Parse individual swap transaction logs, 3) Track fee collection events',
    protocol: protocolFees,
    pools: poolFees,
  };

  fs.writeFileSync('fees-data.json', JSON.stringify(output, null, 2));

  console.log('\n\n=== PROTOCOL FEES ===\n');
  console.log(`24h Fees: $${protocolFees.fees24h.toLocaleString()}`);
  console.log(`7d Fees: $${protocolFees.fees7d.toLocaleString()}`);
  console.log(`All-time Fees: $${protocolFees.feesAllTime.toLocaleString()}`);
  console.log(`\n24h Swaps: ${protocolFees.swapCount24h}`);
  console.log(`7d Swaps: ${protocolFees.swapCount7d}`);
  console.log(`All-time Swaps: ${protocolFees.swapCountAllTime}`);

  console.log('\n=== TOP POOLS BY FEES (24h) ===\n');

  const topPools = [...poolFees]
    .sort((a, b) => b.fees24h - a.fees24h)
    .slice(0, 5);

  topPools.forEach((pool, i) => {
    if (pool.fees24h > 0) {
      console.log(`${i + 1}. ${pool.poolName}`);
      console.log(`   Fees 24h: $${pool.fees24h.toFixed(2)}`);
      console.log(`   Swaps 24h: ${pool.swapCount24h}`);
      console.log('');
    }
  });

  console.log('✅ Fee data saved to fees-data.json');

  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('  - These fees are ESTIMATES based on swap count and pool TVL');
  console.log('  - For EXACT fees, we need to:');
  console.log('    1. Decode the 289-byte pool account structure to find fee fields');
  console.log('    2. Parse individual swap transactions to calculate actual fee amounts');
  console.log('    3. Find and analyze fee collection/withdrawal events');
  console.log('  - Actual Darklake fee rate might differ from the 0.3% assumption');

  return output;
}

extractFees().catch(console.error);
