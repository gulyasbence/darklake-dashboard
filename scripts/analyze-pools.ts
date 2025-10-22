import { Connection, PublicKey } from '@solana/web3.js';
import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const DARKLAKE_PROGRAM_ID = 'darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1';
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

async function analyzePoolData() {
  console.log('Connecting to Solana mainnet...\n');
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const programId = new PublicKey(DARKLAKE_PROGRAM_ID);

  // Fetch all program accounts
  const accounts = await connection.getProgramAccounts(programId, {
    encoding: 'base64',
  });

  console.log(`Found ${accounts.length} accounts\n`);

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const data = Buffer.from(account.account.data as any);

    console.log(`\n=== Account ${i + 1}: ${account.pubkey.toString()} ===`);
    console.log(`Data length: ${data.length} bytes`);
    console.log(`Lamports: ${account.account.lamports / 1e9} SOL`);

    // Try to read common patterns
    console.log('\nFirst 32 bytes (hex):');
    console.log(data.subarray(0, 32).toString('hex'));

    // Look for public keys (32 bytes each)
    console.log('\nPotential public keys in data:');
    for (let offset = 0; offset + 32 <= data.length; offset += 32) {
      try {
        const possibleKey = new PublicKey(data.subarray(offset, offset + 32));
        console.log(`  Offset ${offset}: ${possibleKey.toString()}`);
      } catch (e) {
        // Not a valid public key
      }
    }

    // Try to find token accounts associated with this pool
    console.log('\nLooking for associated token accounts...');
    try {
      const tokenAccounts = await connection.getTokenAccountsByOwner(account.pubkey, {
        programId: TOKEN_PROGRAM_ID,
      });

      if (tokenAccounts.value.length > 0) {
        console.log(`Found ${tokenAccounts.value.length} token accounts:`);
        for (const tokenAccount of tokenAccounts.value) {
          const accountInfo = AccountLayout.decode(tokenAccount.account.data);
          console.log(`  Token Account: ${tokenAccount.pubkey.toString()}`);
          console.log(`    Mint: ${accountInfo.mint.toString()}`);
          console.log(`    Amount: ${accountInfo.amount.toString()}`);
          console.log(`    Owner: ${accountInfo.owner.toString()}`);
        }
      } else {
        console.log('  No token accounts found for this pool address');
      }
    } catch (error) {
      console.log('  Error fetching token accounts:', (error as Error).message);
    }
  }

  // Now let's try to find ALL token accounts that might be related
  console.log('\n\n=== Searching for all token accounts related to Darklake ===\n');

  for (const account of accounts) {
    const data = Buffer.from(account.account.data as any);

    // Extract all potential public keys from account data
    const potentialKeys: PublicKey[] = [];
    for (let offset = 0; offset + 32 <= data.length; offset++) {
      try {
        const key = new PublicKey(data.subarray(offset, offset + 32));
        potentialKeys.push(key);
      } catch (e) {
        // Not a valid public key at this offset
      }
    }

    // Check if any of these are token accounts
    for (const key of potentialKeys) {
      try {
        const accountInfo = await connection.getAccountInfo(key);
        if (accountInfo && accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
          console.log(`Found token account: ${key.toString()}`);
          const tokenData = AccountLayout.decode(accountInfo.data);
          console.log(`  Mint: ${tokenData.mint.toString()}`);
          console.log(`  Amount: ${tokenData.amount.toString()}`);
          console.log(`  Owner: ${tokenData.owner.toString()}`);
          console.log('');
        }
      } catch (e) {
        // Skip invalid accounts
      }
    }
  }
}

analyzePoolData().catch(console.error);
