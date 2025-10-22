import { Connection, PublicKey } from '@solana/web3.js';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const POOL_ADDRESS = '2FwaRpni7rhHMQpfihTjpZ5SadwpnTNZzEBSzMPgVSTd';

async function analyzeDeposits() {
  console.log('=== Analyzing Recent Deposits for SOL/USDC Pool ===\n');
  console.log(`Pool: ${POOL_ADDRESS}\n`);

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  try {
    // Fetch recent signatures (last 1000 transactions)
    console.log('Fetching transaction history...\n');
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(POOL_ADDRESS),
      { limit: 1000 }
    );

    console.log(`Found ${signatures.length} total transactions\n`);

    // Analyze each transaction
    const deposits = [];
    const swaps = [];
    const withdrawals = [];

    for (let i = 0; i < Math.min(signatures.length, 50); i++) {
      const sig = signatures[i];
      
      try {
        const tx = await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta) continue;

        const timestamp = sig.blockTime ? new Date(sig.blockTime * 1000) : null;
        const instructions = tx.transaction.message.instructions;

        // Look for token transfers to identify deposit/swap/withdrawal patterns
        let hasSOLTransfer = false;
        let hasUSDCTransfer = false;
        let transferCount = 0;

        for (const ix of instructions) {
          if ('parsed' in ix && ix.parsed.type === 'transfer') {
            transferCount++;
            // This is a simplified check - you'd need more logic to differentiate
          }
        }

        // Heuristic: Multiple transfers likely indicate deposit/withdrawal
        // Single transfers might be swaps
        const txType = transferCount >= 2 ? 'Deposit/Withdrawal' : 'Swap';
        
        console.log(`[${i + 1}] ${timestamp?.toISOString() || 'Unknown time'}`);
        console.log(`    Signature: ${sig.signature.substring(0, 20)}...`);
        console.log(`    Type: ${txType}`);
        console.log(`    Instructions: ${instructions.length}, Transfers: ${transferCount}`);
        console.log('');

        // Small delay to avoid rate limiting
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.log(`    Error parsing tx: ${(error as Error).message}`);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Analyzed the most recent 50 transactions`);
    console.log(`\nNote: Detailed deposit amounts require parsing the full transaction logs`);
    console.log(`which involves significant RPC calls. The timing analysis above shows`);
    console.log(`when activity occurred on the pool.`);

  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeDeposits().catch(console.error);
