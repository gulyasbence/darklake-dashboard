import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const LP_MINT = '8N5Htm73Lx2CcyKp7zQfDmyNSM6gtEm6dXPfyAszLzRp'; // From lp-summary.json

async function analyzeLPHolders() {
  console.log('=== Analyzing LP Token Holders ===\n');
  console.log(`LP Mint: ${LP_MINT}\n`);

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  try {
    // Get LP token supply
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(LP_MINT));

    if (mintInfo.value && 'parsed' in mintInfo.value.data) {
      const supply = mintInfo.value.data.parsed.info.supply;
      const decimals = mintInfo.value.data.parsed.info.decimals;
      console.log(`Total LP Supply: ${Number(supply) / Math.pow(10, decimals)}`);
      console.log(`Decimals: ${decimals}\n`);
    }

    // Get largest token accounts (LP holders)
    console.log('Fetching LP token holders...\n');
    const largestAccounts = await connection.getTokenLargestAccounts(new PublicKey(LP_MINT));

    console.log(`Found ${largestAccounts.value.length} LP token holders:\n`);

    for (let i = 0; i < largestAccounts.value.length; i++) {
      const account = largestAccounts.value[i];
      const amount = Number(account.amount);

      if (amount > 0) {
        console.log(`[${i + 1}] ${account.address.toString()}`);
        console.log(`    Amount: ${amount / 1e9} LP tokens`);
        console.log(`    Percentage: ${(amount / Number(largestAccounts.value[0].amount) * 100).toFixed(2)}%`);

        // Try to get account info to see when it was created/last modified
        try {
          const accountInfo = await connection.getParsedAccountInfo(account.address);
          if (accountInfo.value && 'parsed' in accountInfo.value.data) {
            const owner = accountInfo.value.data.parsed.info.owner;
            console.log(`    Owner: ${owner}`);
          }

          // Get recent transaction history for this LP token account
          const signatures = await connection.getSignaturesForAddress(
            account.address,
            { limit: 5 }
          );

          if (signatures.length > 0) {
            console.log(`    Recent activity:`);
            signatures.forEach((sig, idx) => {
              const time = sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : 'Unknown';
              console.log(`      [${idx + 1}] ${time}`);
            });
          }
        } catch (error) {
          console.log(`    Error fetching account details: ${(error as Error).message}`);
        }

        console.log('');

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeLPHolders().catch(console.error);
