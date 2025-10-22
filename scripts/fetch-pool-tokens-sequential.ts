import { Connection, PublicKey } from '@solana/web3.js';
import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const DARKLAKE_PROGRAM_ID = 'darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1';

interface TokenAccountData {
  address: string;
  mint: string;
  amount: string;
  owner: string;
}

interface PoolData {
  address: string;
  tokenAccounts: TokenAccountData[];
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPoolTokensSequential() {
  console.log(`Using RPC: ${RPC_ENDPOINT}\n`);

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const programId = new PublicKey(DARKLAKE_PROGRAM_ID);

  console.log('Fetching Darklake program accounts...');
  const accounts = await connection.getProgramAccounts(programId);
  console.log(`Found ${accounts.length} accounts\n`);

  const poolsData: PoolData[] = [];

  // Process accounts sequentially with delays
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const data = Buffer.from(account.account.data as any);

    console.log(`\n[${i + 1}/${accounts.length}] Analyzing: ${account.pubkey.toString()}`);
    console.log(`Data length: ${data.length} bytes`);

    const tokenAccounts: TokenAccountData[] = [];

    // Check specific 32-byte aligned offsets
    const offsets = [32, 64, 96, 128, 160, 192];

    for (const offset of offsets) {
      if (offset + 32 > data.length) continue;

      try {
        const key = new PublicKey(data.subarray(offset, offset + 32));

        // Skip system program
        if (key.toBase58() === '11111111111111111111111111111111') {
          continue;
        }

        // Add delay between requests
        await sleep(200);

        const accountInfo = await connection.getAccountInfo(key);

        if (accountInfo && accountInfo.owner.equals(TOKEN_PROGRAM_ID) && accountInfo.data.length === 165) {
          const tokenData = AccountLayout.decode(accountInfo.data);

          console.log(`  ✓ Token account found at offset ${offset}`);
          console.log(`    Address: ${key.toString()}`);
          console.log(`    Mint: ${tokenData.mint.toString()}`);
          console.log(`    Amount: ${tokenData.amount.toString()}`);

          tokenAccounts.push({
            address: key.toString(),
            mint: tokenData.mint.toString(),
            amount: tokenData.amount.toString(),
            owner: tokenData.owner.toString(),
          });
        }
      } catch (e) {
        // Skip invalid keys
      }
    }

    if (tokenAccounts.length > 0) {
      poolsData.push({
        address: account.pubkey.toString(),
        tokenAccounts,
      });
    }
  }

  console.log('\n\n=== SUMMARY ===\n');
  console.log(`Found ${poolsData.length} pools with token accounts\n`);

  poolsData.forEach((pool, i) => {
    console.log(`Pool ${i + 1}: ${pool.address}`);
    pool.tokenAccounts.forEach(ta => {
      console.log(`  Token: ${ta.address}`);
      console.log(`    Mint: ${ta.mint}`);
      console.log(`    Amount: ${ta.amount}`);
    });
    console.log('');
  });

  // Save to file
  const output = {
    fetchedAt: new Date().toISOString(),
    programId: DARKLAKE_PROGRAM_ID,
    totalPools: poolsData.length,
    pools: poolsData,
  };

  fs.writeFileSync(
    'pool-data.json',
    JSON.stringify(output, null, 2)
  );

  console.log('✅ Data saved to pool-data.json');

  return output;
}

fetchPoolTokensSequential()
  .then(data => {
    console.log('\n=== NEXT STEPS ===');
    console.log('Now we need to:');
    console.log('1. Identify which mints are which tokens (SOL, USDC, etc.)');
    console.log('2. Get token prices');
    console.log('3. Calculate TVL');
  })
  .catch(console.error);
