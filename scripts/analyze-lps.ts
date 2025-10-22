import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const DARKLAKE_PROGRAM_ID = 'darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1';

interface LPData {
  poolAddress: string;
  poolName: string;
  lpCount: number;
  totalDeposits: number;
  averageDeposit: number;
  uniqueDepositors: string[];
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeLPs() {
  console.log('=== Analyzing Liquidity Providers ===\n');

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const programId = new PublicKey(DARKLAKE_PROGRAM_ID);

  // Load pool data for context
  const poolData = JSON.parse(fs.readFileSync('final-dashboard-data.json', 'utf-8'));

  const lpAnalysis: LPData[] = [];
  const allDepositors = new Set<string>();

  console.log('Finding liquidity providers by analyzing token account ownership...\n');

  for (let i = 0; i < poolData.pools.length; i++) {
    const pool = poolData.pools[i];
    console.log(`\n[${i + 1}/${poolData.pools.length}] Analyzing: ${pool.poolName}`);
    console.log(`Pool: ${pool.poolAddress}`);

    if (pool.tokens.length === 0) {
      console.log('  Empty pool, skipping...');
      continue;
    }

    // Get all token accounts for this pool's tokens
    const depositors = new Set<string>();
    let totalValue = 0;

    // For each token in the pool, find who has provided liquidity
    // In most AMMs, the pool itself holds the tokens, but we can look for:
    // 1. LP token holders (if LP tokens exist)
    // 2. Historical depositors from transaction signatures

    try {
      // Method 1: Check for LP token mint
      // Look for a mint that might be the LP token (often created by the pool)
      console.log('  Searching for LP token...');

      // Get signatures for the pool to find depositors
      await sleep(300);
      const signatures = await connection.getSignaturesForAddress(
        new PublicKey(pool.poolAddress),
        { limit: 100 }
      );

      console.log(`  Found ${signatures.length} transactions`);

      // Analyze transactions to find unique signers (depositors)
      const uniqueSigners = new Set<string>();

      for (const sig of signatures.slice(0, 50)) { // Limit to avoid rate limits
        try {
          await sleep(200);
          const tx = await connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (tx && tx.transaction.message.accountKeys) {
            // First account key is usually the signer/depositor
            const signer = tx.transaction.message.accountKeys[0].toString();
            if (signer !== pool.poolAddress && signer !== DARKLAKE_PROGRAM_ID) {
              uniqueSigners.add(signer);
              allDepositors.add(signer);
            }
          }
        } catch (e) {
          // Skip failed tx fetches
        }
      }

      const lpCount = uniqueSigners.size;
      const avgDeposit = lpCount > 0 ? pool.tvl / lpCount : 0;

      console.log(`  Unique depositors found: ${lpCount}`);
      console.log(`  Average deposit: $${avgDeposit.toLocaleString()}`);

      lpAnalysis.push({
        poolAddress: pool.poolAddress,
        poolName: pool.poolName,
        lpCount,
        totalDeposits: pool.tvl,
        averageDeposit: avgDeposit,
        uniqueDepositors: Array.from(uniqueSigners),
      });

    } catch (error) {
      console.log(`  Error analyzing pool: ${(error as Error).message}`);

      // Add placeholder data
      lpAnalysis.push({
        poolAddress: pool.poolAddress,
        poolName: pool.poolName,
        lpCount: 0,
        totalDeposits: pool.tvl,
        averageDeposit: 0,
        uniqueDepositors: [],
      });
    }
  }

  // Calculate overall statistics
  const totalLPs = allDepositors.size;
  const totalTVL = lpAnalysis.reduce((sum, pool) => sum + pool.totalDeposits, 0);
  const averageDepositOverall = totalLPs > 0 ? totalTVL / totalLPs : 0;

  const output = {
    fetchedAt: new Date().toISOString(),
    overall: {
      totalLPs,
      totalTVL,
      averageDeposit: averageDepositOverall,
      activePools: lpAnalysis.filter(p => p.lpCount > 0).length,
    },
    pools: lpAnalysis,
  };

  // Save results
  fs.writeFileSync('lp-analysis.json', JSON.stringify(output, null, 2));

  console.log('\n\n=== OVERALL LP STATISTICS ===\n');
  console.log(`Total Unique LPs: ${totalLPs}`);
  console.log(`Total TVL: $${totalTVL.toLocaleString()}`);
  console.log(`Average Deposit per LP: $${averageDepositOverall.toLocaleString()}`);
  console.log(`Active Pools: ${output.overall.activePools}`);

  console.log('\n=== PER POOL BREAKDOWN ===\n');
  lpAnalysis.forEach((pool, i) => {
    if (pool.lpCount > 0) {
      console.log(`${i + 1}. ${pool.poolName}`);
      console.log(`   LPs: ${pool.lpCount}`);
      console.log(`   Total Deposits: $${pool.totalDeposits.toLocaleString()}`);
      console.log(`   Average Deposit: $${pool.averageDeposit.toLocaleString()}`);
      console.log('');
    }
  });

  console.log('✅ LP analysis saved to lp-analysis.json');

  console.log('\n⚠️  NOTE: LP counts are estimated from transaction history.');
  console.log('For exact counts, we would need:');
  console.log('  - LP token mint addresses (if they exist)');
  console.log('  - Complete transaction history parsing');
  console.log('  - Account state tracking over time');

  return output;
}

analyzeLPs().catch(console.error);
