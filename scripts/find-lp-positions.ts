import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
const DARKLAKE_PROGRAM_ID = 'darkr3FB87qAZmgLwKov6Hk9Yiah5UT4rUYu8Zhthw1';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findLPPositions() {
  console.log('=== Finding LP Positions & LP Tokens ===\n');

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const programId = new PublicKey(DARKLAKE_PROGRAM_ID);

  // Load pool data
  const poolData = JSON.parse(fs.readFileSync('final-dashboard-data.json', 'utf-8'));

  console.log('Strategy 1: Looking for LP position accounts owned by Darklake program...\n');

  // Get all accounts owned by the Darklake program
  const allAccounts = await connection.getProgramAccounts(programId);
  console.log(`Total program accounts: ${allAccounts.length}\n`);

  // Categorize accounts by size
  const accountsBySize: Record<number, number> = {};
  allAccounts.forEach(acc => {
    const size = acc.account.data.length;
    accountsBySize[size] = (accountsBySize[size] || 0) + 1;
  });

  console.log('Account distribution by size:');
  Object.entries(accountsBySize).forEach(([size, count]) => {
    console.log(`  ${size} bytes: ${count} accounts`);
  });

  // Look for potential LP position accounts (different from pool accounts)
  const poolSizes = new Set([289, 186]); // Known pool account sizes
  const potentialLPAccounts = allAccounts.filter(
    acc => !poolSizes.has(acc.account.data.length)
  );

  console.log(`\nPotential LP position accounts: ${potentialLPAccounts.length}`);

  if (potentialLPAccounts.length > 0) {
    console.log('\nSample LP position accounts:');
    potentialLPAccounts.slice(0, 5).forEach(acc => {
      console.log(`  ${acc.pubkey.toString()} (${acc.account.data.length} bytes)`);
    });
  }

  console.log('\n\nStrategy 2: Looking for LP token mints...\n');

  const lpTokenInfo: any[] = [];

  for (const pool of poolData.pools) {
    if (pool.tokens.length === 0) continue;

    console.log(`\nChecking pool: ${pool.poolName} (${pool.poolAddress})`);

    // Try to find LP token mint by looking for mints created by or associated with the pool
    // Strategy: Check if there's a PDA mint for this pool
    try {
      // Common LP mint derivation patterns
      const seeds = [
        ['lp_mint', new PublicKey(pool.poolAddress).toBuffer()],
        ['mint', new PublicKey(pool.poolAddress).toBuffer()],
        ['lp', new PublicKey(pool.poolAddress).toBuffer()],
      ];

      for (const seed of seeds) {
        try {
          const [lpMintPDA] = PublicKey.findProgramAddressSync(
            seed as Buffer[],
            programId
          );

          await sleep(200);
          const mintInfo = await connection.getAccountInfo(lpMintPDA);

          if (mintInfo) {
            console.log(`  ✓ Found potential LP mint: ${lpMintPDA.toString()}`);

            // Get mint details
            try {
              const mint = await getMint(connection, lpMintPDA);
              console.log(`    Supply: ${Number(mint.supply) / Math.pow(10, mint.decimals)}`);
              console.log(`    Decimals: ${mint.decimals}`);

              // Find all holders of this LP token
              await sleep(300);
              const tokenAccounts = await connection.getTokenAccountsByOwner(
                new PublicKey(pool.poolAddress),
                { mint: lpMintPDA }
              );

              console.log(`    Token accounts: ${tokenAccounts.value.length}`);

              // Try to get all token accounts for this mint (to find LPs)
              await sleep(300);
              const allHolders = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
                filters: [
                  { dataSize: 165 }, // Token account size
                  {
                    memcmp: {
                      offset: 0,
                      bytes: lpMintPDA.toBase58(),
                    },
                  },
                ],
              });

              console.log(`    Total LP holders: ${allHolders.length}`);

              lpTokenInfo.push({
                poolAddress: pool.poolAddress,
                poolName: pool.poolName,
                lpMint: lpMintPDA.toString(),
                supply: Number(mint.supply) / Math.pow(10, mint.decimals),
                holders: allHolders.length,
              });
            } catch (e) {
              console.log(`    Error getting mint details: ${(e as Error).message}`);
            }
          }
        } catch (e) {
          // PDA not found for this seed
        }
      }
    } catch (error) {
      console.log(`  Error: ${(error as Error).message}`);
    }
  }

  console.log('\n\nStrategy 3: Analyzing pool ownership structure...\n');

  // The vault authority we saw: EEyriyMqraVrZy5Gm4RYsbxBwfLwQXG15ZJSczdVn3fD
  const vaultAuthority = 'EEyriyMqraVrZy5Gm4RYsbxBwfLwQXG15ZJSczdVn3fD';
  console.log(`Vault Authority: ${vaultAuthority}`);

  // Check what this authority controls
  await sleep(300);
  const authorityAccount = await connection.getAccountInfo(new PublicKey(vaultAuthority));
  if (authorityAccount) {
    console.log(`  Account exists`);
    console.log(`  Owner: ${authorityAccount.owner.toString()}`);
    console.log(`  Data length: ${authorityAccount.data.length}`);
  }

  // Save results
  const output = {
    fetchedAt: new Date().toISOString(),
    totalProgramAccounts: allAccounts.length,
    accountDistribution: accountsBySize,
    potentialLPAccounts: potentialLPAccounts.length,
    lpTokensFound: lpTokenInfo,
    vaultAuthority,
  };

  fs.writeFileSync('lp-structure-analysis.json', JSON.stringify(output, null, 2));

  console.log('\n\n=== SUMMARY ===\n');
  console.log(`Total Darklake accounts: ${allAccounts.length}`);
  console.log(`Known pool accounts: ${allAccounts.filter(a => poolSizes.has(a.account.data.length)).length}`);
  console.log(`Other accounts (potential LP positions): ${potentialLPAccounts.length}`);
  console.log(`LP tokens found: ${lpTokenInfo.length}`);

  if (lpTokenInfo.length > 0) {
    console.log('\nLP Token Details:');
    lpTokenInfo.forEach(info => {
      console.log(`  ${info.poolName}:`);
      console.log(`    LP Mint: ${info.lpMint}`);
      console.log(`    Holders: ${info.holders}`);
      console.log(`    Supply: ${info.supply.toLocaleString()}`);
    });
  } else {
    console.log('\n⚠️  No LP tokens found using standard derivation patterns.');
    console.log('Darklake might use a different LP tracking mechanism:');
    console.log('  - Non-standard PDA seeds');
    console.log('  - LP positions tracked in program accounts');
    console.log('  - Alternative liquidity tracking method');
  }

  console.log('\n✅ Analysis saved to lp-structure-analysis.json');

  return output;
}

findLPPositions().catch(console.error);
