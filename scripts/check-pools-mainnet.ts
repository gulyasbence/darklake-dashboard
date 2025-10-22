import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const DARKLAKE_PROGRAM_ID = 'darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1';

// Well-known Solana token mints
const KNOWN_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Wrapped SOL', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', name: 'Marinade staked SOL', decimals: 9 },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk', decimals: 5 },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', name: 'Jupiter', decimals: 6 },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'WIF', name: 'dogwifhat', decimals: 6 },
};

async function checkPoolsMainnet() {
  console.log('=== Checking Darklake Pools on Mainnet ===\n');

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const programId = new PublicKey(DARKLAKE_PROGRAM_ID);

  // Check if program exists
  console.log('Checking program account...');
  const programAccount = await connection.getAccountInfo(programId);

  if (!programAccount) {
    console.log('❌ Program not found on mainnet!');
    return;
  }

  console.log('✓ Program exists');
  console.log(`  Executable: ${programAccount.executable}`);
  console.log(`  Owner: ${programAccount.owner.toString()}`);
  console.log(`  Data length: ${programAccount.data.length} bytes\n`);

  // Get all program accounts
  console.log('Fetching all program accounts...');
  const accounts = await connection.getProgramAccounts(programId);
  console.log(`Found ${accounts.length} accounts\n`);

  // Analyze each account
  const accountSummary = accounts.map((account, i) => {
    const data = Buffer.from(account.account.data);

    return {
      index: i + 1,
      address: account.pubkey.toString(),
      lamports: account.account.lamports / 1e9,
      dataSize: data.length,
      owner: account.account.owner.toString(),
      // Try to extract some basic info from data
      discriminator: data.subarray(0, 8).toString('hex'),
    };
  });

  console.log('=== ACCOUNT SUMMARY ===\n');
  accountSummary.forEach(acc => {
    console.log(`Account ${acc.index}: ${acc.address}`);
    console.log(`  Lamports: ${acc.lamports} SOL`);
    console.log(`  Data Size: ${acc.dataSize} bytes`);
    console.log(`  Discriminator: ${acc.discriminator}`);
    console.log('');
  });

  // Save summary
  const output = {
    fetchedAt: new Date().toISOString(),
    programId: DARKLAKE_PROGRAM_ID,
    programExists: true,
    totalAccounts: accounts.length,
    accounts: accountSummary,
  };

  fs.writeFileSync('mainnet-pools-summary.json', JSON.stringify(output, null, 2));
  console.log('✅ Summary saved to mainnet-pools-summary.json');

  // Check if we have the complete pool data
  if (fs.existsSync('complete-pool-data.json')) {
    console.log('\n📊 Complete pool data exists! Loading...');
    const completeData = JSON.parse(fs.readFileSync('complete-pool-data.json', 'utf-8'));

    console.log(`\nPools with token accounts: ${completeData.poolsWithTokens}`);

    // Identify tokens
    const allMints = new Set<string>();
    completeData.pools.forEach((pool: any) => {
      pool.tokenAccounts?.forEach((ta: any) => {
        allMints.add(ta.mint);
      });
    });

    console.log(`\nUnique token mints found: ${allMints.size}`);
    Array.from(allMints).forEach(mint => {
      const known = KNOWN_TOKENS[mint];
      if (known) {
        console.log(`  ✓ ${known.symbol} (${known.name})`);
      } else {
        console.log(`  ? Unknown: ${mint.substring(0, 8)}...`);
      }
    });
  }
}

checkPoolsMainnet().catch(console.error);
