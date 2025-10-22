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

async function fetchPoolTokensFast() {
  console.log(`Using RPC: ${RPC_ENDPOINT}\n`);

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const programId = new PublicKey(DARKLAKE_PROGRAM_ID);

  console.log('Fetching Darklake program accounts...');
  const accounts = await connection.getProgramAccounts(programId);
  console.log(`Found ${accounts.length} accounts\n`);

  const poolsData: PoolData[] = [];

  // Process accounts in parallel for speed
  const promises = accounts.map(async (account, i) => {
    const data = Buffer.from(account.account.data as any);
    console.log(`Analyzing account ${i + 1}/${accounts.length}: ${account.pubkey.toString()}`);

    const tokenAccounts: TokenAccountData[] = [];

    // Check specific 32-byte aligned offsets (more efficient)
    const offsets = [0, 32, 64, 96, 128, 160, 192, 224, 256];

    for (const offset of offsets) {
      if (offset + 32 > data.length) continue;

      try {
        const key = new PublicKey(data.subarray(offset, offset + 32));

        // Skip system program and obviously invalid keys
        if (key.equals(PublicKey.default) || key.toBase58() === '11111111111111111111111111111111') {
          continue;
        }

        const accountInfo = await connection.getAccountInfo(key);

        if (accountInfo && accountInfo.owner.equals(TOKEN_PROGRAM_ID) && accountInfo.data.length === 165) {
          const tokenData = AccountLayout.decode(accountInfo.data);

          console.log(`  ✓ Found token account at offset ${offset}: ${key.toString()}`);
          console.log(`    Mint: ${tokenData.mint.toString()}`);
          console.log(`    Amount: ${tokenData.amount.toString()}`);
          console.log(`    Owner: ${tokenData.owner.toString()}`);

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

    return {
      address: account.pubkey.toString(),
      tokenAccounts,
    };
  });

  const results = await Promise.all(promises);
  poolsData.push(...results.filter(r => r.tokenAccounts.length > 0));

  console.log('\n\n=== SUMMARY ===\n');
  console.log(`Found ${poolsData.length} pools with token accounts:\n`);

  let totalTVL = 0;

  poolsData.forEach((pool, i) => {
    console.log(`Pool ${i + 1}: ${pool.address}`);
    console.log(`  Token accounts: ${pool.tokenAccounts.length}`);
    pool.tokenAccounts.forEach(ta => {
      console.log(`    - ${ta.address}`);
      console.log(`      Mint: ${ta.mint}`);
      console.log(`      Amount: ${ta.amount}`);
      console.log(`      Owner: ${ta.owner}`);
    });
    console.log('');
  });

  // Save to file
  const output = {
    fetchedAt: new Date().toISOString(),
    rpcEndpoint: RPC_ENDPOINT,
    programId: DARKLAKE_PROGRAM_ID,
    totalPools: poolsData.length,
    pools: poolsData,
  };

  fs.writeFileSync(
    'pool-data.json',
    JSON.stringify(output, null, 2)
  );

  console.log('✅ Data saved to pool-data.json\n');
  console.log('=== JSON OUTPUT ===');
  console.log(JSON.stringify(output, null, 2));
}

fetchPoolTokensFast().catch(console.error);
