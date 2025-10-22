import { Connection, PublicKey } from '@solana/web3.js';
import { AccountLayout, TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const DARKLAKE_PROGRAM_ID = 'darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1';

interface TokenInfo {
  address: string;
  mint: string;
  amount: string;
  decimals: number;
  owner: string;
  uiAmount: number;
}

interface PoolInfo {
  address: string;
  dataLength: number;
  tokenAccounts: TokenInfo[];
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAllPoolData() {
  console.log('=== Fetching Complete Darklake Pool Data ===\n');
  console.log(`RPC: ${RPC_ENDPOINT}\n`);

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const programId = new PublicKey(DARKLAKE_PROGRAM_ID);

  console.log('Step 1: Fetching all program accounts...');
  const accounts = await connection.getProgramAccounts(programId);
  console.log(`Found ${accounts.length} pool accounts\n`);

  const allPools: PoolInfo[] = [];

  // Process each pool
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const data = Buffer.from(account.account.data as any);

    console.log(`\n[${ i + 1}/${accounts.length}] Processing pool: ${account.pubkey.toString()}`);
    console.log(`  Data size: ${data.length} bytes`);

    const tokenAccounts: TokenInfo[] = [];

    // Extract all potential public keys (scan every byte offset)
    const checkedKeys = new Set<string>();

    console.log('  Scanning for token accounts...');

    for (let offset = 0; offset <= data.length - 32; offset++) {
      try {
        const keyBuffer = data.subarray(offset, offset + 32);
        const key = new PublicKey(keyBuffer);
        const keyStr = key.toString();

        // Skip if already checked or system program
        if (checkedKeys.has(keyStr) || keyStr === '11111111111111111111111111111111') {
          continue;
        }

        checkedKeys.add(keyStr);

        // Rate limiting
        await sleep(150);

        try {
          const accountInfo = await connection.getAccountInfo(key);

          // Check if it's a token account
          if (accountInfo &&
              accountInfo.owner.equals(TOKEN_PROGRAM_ID) &&
              accountInfo.data.length === 165) {

            const tokenData = AccountLayout.decode(accountInfo.data);

            // Try to get mint info for decimals
            let decimals = 9; // default
            try {
              await sleep(150);
              const mintInfo = await getMint(connection, tokenData.mint);
              decimals = mintInfo.decimals;
            } catch (e) {
              // Use default if can't fetch
            }

            const amount = tokenData.amount.toString();
            const uiAmount = Number(amount) / Math.pow(10, decimals);

            console.log(`    ✓ Found token account at offset ${offset}`);
            console.log(`      Address: ${keyStr}`);
            console.log(`      Mint: ${tokenData.mint.toString()}`);
            console.log(`      Amount: ${uiAmount.toLocaleString()}`);

            tokenAccounts.push({
              address: keyStr,
              mint: tokenData.mint.toString(),
              amount,
              decimals,
              owner: tokenData.owner.toString(),
              uiAmount,
            });
          }
        } catch (e) {
          // Account doesn't exist or error fetching
          if ((e as any).message?.includes('429')) {
            console.log('    Rate limited, waiting...');
            await sleep(2000);
            offset--; // Retry this offset
          }
        }
      } catch (e) {
        // Invalid public key at this offset
      }
    }

    console.log(`  Found ${tokenAccounts.length} token accounts in this pool`);

    allPools.push({
      address: account.pubkey.toString(),
      dataLength: data.length,
      tokenAccounts,
    });
  }

  // Summary
  console.log('\n\n=== SUMMARY ===\n');
  console.log(`Total pools analyzed: ${allPools.length}`);
  console.log(`Pools with token accounts: ${allPools.filter(p => p.tokenAccounts.length > 0).length}\n`);

  allPools.forEach((pool, i) => {
    console.log(`Pool ${i + 1}: ${pool.address}`);
    console.log(`  Token accounts: ${pool.tokenAccounts.length}`);
    pool.tokenAccounts.forEach(ta => {
      console.log(`    - ${ta.uiAmount.toLocaleString()} tokens (Mint: ${ta.mint.substring(0, 8)}...)`);
    });
  });

  // Save to file
  const output = {
    fetchedAt: new Date().toISOString(),
    programId: DARKLAKE_PROGRAM_ID,
    totalPools: allPools.length,
    poolsWithTokens: allPools.filter(p => p.tokenAccounts.length > 0).length,
    pools: allPools,
  };

  fs.writeFileSync('complete-pool-data.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Complete data saved to complete-pool-data.json');

  return output;
}

getAllPoolData()
  .then(() => {
    console.log('\n=== Next: Run identify-tokens script to get token names ===');
  })
  .catch(console.error);
