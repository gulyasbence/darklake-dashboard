import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

const UNKNOWN_MINTS = [
  '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
  '71Jvq4Epe2FCJ7JFSF7jLXdNk1Wy4Bhqd9iL6bEFELvg',
  'HXsKnhXPtGr2mq4uTpxbxyy7ZydYWJwx4zMuYPEDukY',
];

async function fetchTokenInfo() {
  console.log('=== Fetching Unknown Token Information ===\n');

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  const tokenInfo: any[] = [];

  for (const mintAddress of UNKNOWN_MINTS) {
    console.log(`\nToken: ${mintAddress}`);
    console.log(`Solscan: https://solscan.io/token/${mintAddress}`);

    try {
      const mint = await getMint(connection, new PublicKey(mintAddress));

      console.log(`  Decimals: ${mint.decimals}`);
      console.log(`  Supply: ${(Number(mint.supply) / Math.pow(10, mint.decimals)).toLocaleString()}`);
      console.log(`  Mint Authority: ${mint.mintAuthority?.toString() || 'None (frozen)'}`);
      console.log(`  Freeze Authority: ${mint.freezeAuthority?.toString() || 'None'}`);

      // Try to fetch metadata account (Metaplex standard)
      const metadataPDA = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
          new PublicKey(mintAddress).toBuffer(),
        ],
        new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
      )[0];

      const metadataAccount = await connection.getAccountInfo(metadataPDA);

      if (metadataAccount) {
        console.log('  ✓ Has Metaplex metadata account');

        // Try to decode basic info from metadata
        try {
          const data = metadataAccount.data;

          // Skip first byte (key), then read name (first 32 bytes after u32 length)
          let offset = 1 + 32 + 32 + 4; // key + update authority + mint + name length
          const nameLength = data.readUInt32LE(offset - 4);
          const nameBytes = data.slice(offset, offset + nameLength);
          const name = nameBytes.toString('utf8').replace(/\0/g, '').trim();

          offset += 32; // max name length
          offset += 4; // symbol length
          const symbolLength = data.readUInt32LE(offset - 4);
          const symbolBytes = data.slice(offset, offset + symbolLength);
          const symbol = symbolBytes.toString('utf8').replace(/\0/g, '').trim();

          console.log(`  Name: ${name || 'Unknown'}`);
          console.log(`  Symbol: ${symbol || 'UNKNOWN'}`);

          tokenInfo.push({
            mint: mintAddress,
            name: name || 'Unknown',
            symbol: symbol || 'UNKNOWN',
            decimals: mint.decimals,
            supply: Number(mint.supply) / Math.pow(10, mint.decimals),
            hasMetadata: true,
          });
        } catch (e) {
          console.log('  Could not decode metadata');
          tokenInfo.push({
            mint: mintAddress,
            name: `Token ${mintAddress.substring(0, 8)}`,
            symbol: 'UNKNOWN',
            decimals: mint.decimals,
            supply: Number(mint.supply) / Math.pow(10, mint.decimals),
            hasMetadata: true,
          });
        }
      } else {
        console.log('  ❌ No Metaplex metadata found');
        console.log('  This might be a raw SPL token without metadata');

        tokenInfo.push({
          mint: mintAddress,
          name: `Token ${mintAddress.substring(0, 8)}`,
          symbol: 'UNKNOWN',
          decimals: mint.decimals,
          supply: Number(mint.supply) / Math.pow(10, mint.decimals),
          hasMetadata: false,
        });
      }
    } catch (error) {
      console.log(`  Error: ${(error as Error).message}`);
    }
  }

  // Save results
  fs.writeFileSync('unknown-tokens.json', JSON.stringify(tokenInfo, null, 2));

  console.log('\n\n=== SUMMARY ===\n');
  tokenInfo.forEach(token => {
    console.log(`${token.symbol.padEnd(12)} | ${token.name.padEnd(30)} | Supply: ${token.supply.toLocaleString()}`);
  });

  console.log('\n✅ Data saved to unknown-tokens.json');

  return tokenInfo;
}

fetchTokenInfo().catch(console.error);
