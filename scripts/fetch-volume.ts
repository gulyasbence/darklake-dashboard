import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const DARKLAKE_PROGRAM_ID = 'darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1';

interface VolumeData {
  volume24h: number;
  volume7d: number;
  volume30d: number;
  txCount24h: number;
  txCount7d: number;
  txCount30d: number;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchVolume() {
  console.log('=== Fetching Darklake Volume Data ===\n');

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const programId = new PublicKey(DARKLAKE_PROGRAM_ID);

  // Get all pool accounts
  console.log('Fetching pool accounts...');
  const pools = await connection.getProgramAccounts(programId);
  console.log(`Found ${pools.length} pools\n`);

  const now = Date.now() / 1000;
  const day = 24 * 60 * 60;
  const cutoff24h = now - day;
  const cutoff7d = now - (7 * day);
  const cutoff30d = now - (30 * day);

  let volume24h = 0;
  let volume7d = 0;
  let volume30d = 0;
  let txCount24h = 0;
  let txCount7d = 0;
  let txCount30d = 0;

  // Fetch transaction signatures for each pool
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    console.log(`\n[${i + 1}/${pools.length}] Fetching transactions for: ${pool.pubkey.toString()}`);

    try {
      await sleep(300);

      // Fetch signatures (limit to recent ones)
      const signatures = await connection.getSignaturesForAddress(pool.pubkey, {
        limit: 1000, // Get last 1000 transactions
      });

      console.log(`  Found ${signatures.length} transactions`);

      // Count transactions in different timeframes
      let poolTx24h = 0;
      let poolTx7d = 0;
      let poolTx30d = 0;

      for (const sig of signatures) {
        const txTime = sig.blockTime || 0;

        if (txTime >= cutoff24h) {
          poolTx24h++;
          txCount24h++;
        }
        if (txTime >= cutoff7d) {
          poolTx7d++;
          txCount7d++;
        }
        if (txTime >= cutoff30d) {
          poolTx30d++;
          txCount30d++;
        }
      }

      console.log(`  24h: ${poolTx24h} txs | 7d: ${poolTx7d} txs | 30d: ${poolTx30d} txs`);

      // Note: We can't easily calculate volume without parsing each transaction
      // This would require fetching and parsing transaction details
      // For now, we'll estimate based on transaction count

    } catch (error) {
      console.log(`  Error fetching transactions: ${(error as Error).message}`);
      if ((error as any).message?.includes('429')) {
        console.log('  Rate limited, waiting...');
        await sleep(3000);
        i--; // Retry this pool
      }
    }
  }

  console.log('\n\n=== VOLUME SUMMARY ===\n');
  console.log(`Transaction Counts:`);
  console.log(`  24h: ${txCount24h} transactions`);
  console.log(`  7d: ${txCount7d} transactions`);
  console.log(`  30d: ${txCount30d} transactions`);
  console.log('\nNote: Volume in USD requires parsing transaction details');
  console.log('This is a transaction count analysis for now.\n');

  const volumeData: VolumeData = {
    volume24h: 0, // Would need transaction parsing
    volume7d: 0,
    volume30d: 0,
    txCount24h,
    txCount7d,
    txCount30d,
  };

  const output = {
    fetchedAt: new Date().toISOString(),
    programId: DARKLAKE_PROGRAM_ID,
    ...volumeData,
    note: 'Volume in USD requires parsing individual transactions. Currently showing transaction counts.',
  };

  fs.writeFileSync('volume-data.json', JSON.stringify(output, null, 2));
  console.log('✅ Volume data saved to volume-data.json');

  return output;
}

fetchVolume().catch(console.error);
