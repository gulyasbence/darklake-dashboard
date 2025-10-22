import { Connection, PublicKey } from '@solana/web3.js';
import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Use Helius free tier or set your own RPC
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const DARKLAKE_PROGRAM_ID = 'darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1';

interface PoolData {
  address: string;
  tokenAccounts: Array<{
    address: string;
    mint: string;
    amount: string;
    decimals?: number;
  }>;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPoolTokens() {
  console.log(`Using RPC: ${RPC_ENDPOINT}`);
  console.log('Set RPC_ENDPOINT environment variable to use a different RPC\n');

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const programId = new PublicKey(DARKLAKE_PROGRAM_ID);

  // Fetch all program accounts
  console.log('Fetching Darklake program accounts...');
  const accounts = await connection.getProgramAccounts(programId);

  console.log(`Found ${accounts.length} accounts\n`);

  const poolsData: PoolData[] = [];

  // For each account, extract potential token account addresses from the data
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const data = Buffer.from(account.account.data as any);

    console.log(`\nAnalyzing account ${i + 1}/${accounts.length}: ${account.pubkey.toString()}`);

    const tokenAccounts: PoolData['tokenAccounts'] = [];

    // Scan through the data looking for valid public keys
    // that correspond to token accounts
    const potentialKeys: PublicKey[] = [];

    for (let offset = 0; offset + 32 <= data.length; offset++) {
      try {
        const key = new PublicKey(data.subarray(offset, offset + 32));
        // Filter out obviously invalid keys
        if (!key.equals(PublicKey.default)) {
          potentialKeys.push(key);
        }
      } catch (e) {
        // Not a valid public key
      }
    }

    console.log(`  Found ${potentialKeys.length} potential keys in data`);

    // Check each key to see if it's a token account
    // Use batching to avoid rate limits
    for (let j = 0; j < potentialKeys.length; j++) {
      const key = potentialKeys[j];

      try {
        const accountInfo = await connection.getAccountInfo(key);

        if (accountInfo && accountInfo.owner.equals(TOKEN_PROGRAM_ID) && accountInfo.data.length === 165) {
          const tokenData = AccountLayout.decode(accountInfo.data);

          // Check if this token account is owned by the pool or related to Darklake
          console.log(`  ✓ Found token account: ${key.toString()}`);
          console.log(`    Mint: ${tokenData.mint.toString()}`);
          console.log(`    Amount: ${tokenData.amount.toString()}`);
          console.log(`    Owner: ${tokenData.owner.toString()}`);

          tokenAccounts.push({
            address: key.toString(),
            mint: tokenData.mint.toString(),
            amount: tokenData.amount.toString(),
          });
        }

        // Rate limiting: sleep between requests
        await sleep(100);
      } catch (error) {
        if ((error as any).message?.includes('429')) {
          console.log('  Rate limited, waiting 2 seconds...');
          await sleep(2000);
          j--; // Retry this key
        }
        // Skip other errors
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
  console.log(`Found ${poolsData.length} pools with token accounts:\n`);

  poolsData.forEach((pool, i) => {
    console.log(`Pool ${i + 1}: ${pool.address}`);
    console.log(`  Token accounts: ${pool.tokenAccounts.length}`);
    pool.tokenAccounts.forEach(ta => {
      console.log(`    - ${ta.address}`);
      console.log(`      Mint: ${ta.mint}`);
      console.log(`      Amount: ${ta.amount}`);
    });
    console.log('');
  });

  // Export as JSON for further use
  const output = {
    fetchedAt: new Date().toISOString(),
    rpcEndpoint: RPC_ENDPOINT,
    programId: DARKLAKE_PROGRAM_ID,
    pools: poolsData,
  };

  console.log('\n=== JSON OUTPUT ===');
  console.log(JSON.stringify(output, null, 2));
}

fetchPoolTokens().catch(console.error);
