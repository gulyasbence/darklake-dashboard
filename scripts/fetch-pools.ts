import { Connection, PublicKey } from '@solana/web3.js';

const DARKLAKE_PROGRAM_ID = 'darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1';
const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

async function fetchDarklakePools() {
  console.log('Connecting to Solana mainnet...');
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  const programId = new PublicKey(DARKLAKE_PROGRAM_ID);

  console.log(`Fetching all accounts for program: ${DARKLAKE_PROGRAM_ID}`);

  try {
    // Get all program accounts
    const accounts = await connection.getProgramAccounts(programId, {
      encoding: 'base64',
    });

    console.log(`\nFound ${accounts.length} accounts\n`);

    if (accounts.length === 0) {
      console.log('No accounts found. The program might not have any pools yet, or the program ID might be incorrect.');
      return;
    }

    // Display basic info about each account
    accounts.forEach((account, index) => {
      console.log(`Account ${index + 1}:`);
      console.log(`  Address: ${account.pubkey.toString()}`);
      console.log(`  Data length: ${account.account.data.length} bytes`);
      console.log(`  Lamports: ${account.account.lamports / 1e9} SOL`);
      console.log(`  Owner: ${account.account.owner.toString()}`);
      console.log('');
    });

    // Try to identify pool accounts (usually they have significant data)
    const poolAccounts = accounts.filter(acc => acc.account.data.length > 100);
    console.log(`Potential pool accounts: ${poolAccounts.length}`);

    // Save raw data for analysis
    const dataExport = {
      totalAccounts: accounts.length,
      potentialPools: poolAccounts.length,
      accounts: accounts.map(acc => ({
        address: acc.pubkey.toString(),
        dataLength: acc.account.data.length,
        lamports: acc.account.lamports,
        owner: acc.account.owner.toString(),
      }))
    };

    console.log('\n--- Summary ---');
    console.log(JSON.stringify(dataExport, null, 2));

  } catch (error) {
    console.error('Error fetching program accounts:', error);

    // Try to get basic program info
    try {
      const programInfo = await connection.getAccountInfo(programId);
      if (!programInfo) {
        console.log('\nProgram account does not exist on mainnet. It might be on devnet or testnet.');
      } else {
        console.log('\nProgram exists but no accounts found.');
      }
    } catch (err) {
      console.error('Error checking program:', err);
    }
  }
}

fetchDarklakePools().catch(console.error);
