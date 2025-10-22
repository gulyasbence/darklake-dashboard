import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

// Known Solana DEX/AMM program IDs to check
const KNOWN_PROGRAMS = {
  'Raydium AMM': '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  'Raydium CLMM': 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',
  'Orca Whirlpool': 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  'Meteora': 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  'Phoenix': 'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY',
};

async function analyzeSolanaPools() {
  console.log('=== Analyzing Solana DEX Pools ===\n');

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  const allPoolData: any[] = [];

  for (const [name, programId] of Object.entries(KNOWN_PROGRAMS)) {
    console.log(`\nChecking ${name} (${programId})...`);

    try {
      const pubkey = new PublicKey(programId);
      const accounts = await connection.getProgramAccounts(pubkey, {
        filters: [
          {
            dataSize: 752, // Common pool size, adjust as needed
          },
        ],
      });

      console.log(`  Found ${accounts.length} pools`);

      if (accounts.length > 0 && accounts.length < 50) {
        // Only process if reasonable number
        allPoolData.push({
          protocol: name,
          programId,
          poolCount: accounts.length,
          pools: accounts.slice(0, 10).map(a => a.pubkey.toString()), // Sample first 10
        });
      }
    } catch (error) {
      console.log(`  Error: ${(error as Error).message}`);
    }
  }

  console.log('\n\n=== SUMMARY ===\n');
  allPoolData.forEach(data => {
    console.log(`${data.protocol}:`);
    console.log(`  Pool count: ${data.poolCount}`);
    console.log(`  Sample pools: ${data.pools.slice(0, 3).join(', ')}...`);
    console.log('');
  });

  fs.writeFileSync('solana-dex-pools.json', JSON.stringify(allPoolData, null, 2));
  console.log('✅ Data saved to solana-dex-pools.json');
}

analyzeSolanaPools().catch(console.error);
