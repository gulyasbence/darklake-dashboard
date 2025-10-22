import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

// Known tokens
const KNOWN_TOKENS: Record<string, { symbol: string; name: string }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Wrapped SOL' },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin' },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether USD' },
};

interface TokenMetadata {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  source: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTokenMetadata(mint: string, connection: Connection): Promise<TokenMetadata | null> {
  try {
    // Try Metaplex first
    const metaplex = Metaplex.make(connection);
    const mintAddress = new PublicKey(mint);

    try {
      const token = await metaplex.nfts().findByMint({ mintAddress });

      if (token.json?.name || token.json?.symbol) {
        return {
          mint,
          symbol: token.json.symbol || 'UNKNOWN',
          name: token.json.name || 'Unknown Token',
          decimals: token.mint.decimals,
          logoURI: token.json.image,
          source: 'metaplex',
        };
      }
    } catch (e) {
      // Metaplex failed, try other methods
    }

    // Try Jupiter Token List API
    try {
      const response = await fetch(`https://token.jup.ag/token/${mint}`);
      if (response.ok) {
        const data = await response.json();
        return {
          mint,
          symbol: data.symbol || 'UNKNOWN',
          name: data.name || 'Unknown Token',
          decimals: data.decimals,
          logoURI: data.logoURI,
          source: 'jupiter',
        };
      }
    } catch (e) {
      // Jupiter failed
    }

    // Try Solscan API (no auth needed for basic info)
    try {
      await sleep(300); // Rate limit
      const response = await fetch(`https://api.solscan.io/token/meta?token=${mint}`);
      if (response.ok) {
        const data = await response.json();
        if (data.symbol) {
          return {
            mint,
            symbol: data.symbol,
            name: data.name || data.symbol,
            decimals: data.decimals,
            logoURI: data.icon,
            source: 'solscan',
          };
        }
      }
    } catch (e) {
      // Solscan failed
    }

    return null;
  } catch (error) {
    console.log(`  Error fetching metadata: ${(error as Error).message}`);
    return null;
  }
}

async function identifyTokens() {
  console.log('=== Identifying Unknown Tokens ===\n');

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

  // Load pool data
  const poolData = JSON.parse(fs.readFileSync('complete-pool-data.json', 'utf-8'));

  // Extract all unique mints
  const allMints = new Set<string>();
  poolData.pools.forEach((pool: any) => {
    pool.tokenAccounts?.forEach((ta: any) => {
      allMints.add(ta.mint);
    });
  });

  console.log(`Found ${allMints.size} unique token mints\n`);

  const tokenMetadata: Record<string, TokenMetadata> = {};

  // Check each mint
  for (const mint of Array.from(allMints)) {
    console.log(`Checking: ${mint.substring(0, 8)}...`);

    // Check if known
    if (KNOWN_TOKENS[mint]) {
      console.log(`  ✓ Known: ${KNOWN_TOKENS[mint].symbol} (${KNOWN_TOKENS[mint].name})\n`);
      tokenMetadata[mint] = {
        mint,
        symbol: KNOWN_TOKENS[mint].symbol,
        name: KNOWN_TOKENS[mint].name,
        decimals: mint === 'So11111111111111111111111111111111111111112' ? 9 : 6,
        source: 'hardcoded',
      };
      continue;
    }

    // Fetch metadata
    console.log('  Fetching metadata...');
    const metadata = await fetchTokenMetadata(mint, connection);

    if (metadata) {
      console.log(`  ✓ Found: ${metadata.symbol} (${metadata.name})`);
      console.log(`    Source: ${metadata.source}\n`);
      tokenMetadata[mint] = metadata;
    } else {
      console.log(`  ❌ Unknown - no metadata found`);
      console.log(`    Check on Solscan: https://solscan.io/token/${mint}\n`);
      tokenMetadata[mint] = {
        mint,
        symbol: 'UNKNOWN',
        name: `Unknown (${mint.substring(0, 8)})`,
        decimals: 6, // default
        source: 'none',
      };
    }

    await sleep(500); // Rate limiting
  }

  // Create enhanced pool data with token symbols
  const enhancedPools = poolData.pools.map((pool: any) => {
    const enhancedTokenAccounts = pool.tokenAccounts.map((ta: any) => {
      const metadata = tokenMetadata[ta.mint];
      return {
        ...ta,
        symbol: metadata?.symbol || 'UNKNOWN',
        name: metadata?.name || 'Unknown Token',
        logoURI: metadata?.logoURI,
      };
    });

    // Create pool name from tokens
    const tokens = enhancedTokenAccounts.map((ta: any) => ta.symbol);
    const poolName = tokens.length > 0 ? tokens.join('/') : 'Empty Pool';

    return {
      ...pool,
      poolName,
      tokenAccounts: enhancedTokenAccounts,
    };
  });

  // Save results
  const output = {
    fetchedAt: new Date().toISOString(),
    tokenCount: Object.keys(tokenMetadata).length,
    tokens: tokenMetadata,
    pools: enhancedPools,
  };

  fs.writeFileSync('enhanced-pool-data.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Enhanced data saved to enhanced-pool-data.json');

  // Summary
  console.log('\n=== TOKEN SUMMARY ===\n');
  Object.values(tokenMetadata).forEach(token => {
    console.log(`${token.symbol.padEnd(12)} | ${token.name.padEnd(30)} | ${token.mint.substring(0, 12)}...`);
  });

  console.log('\n=== POOL SUMMARY ===\n');
  enhancedPools.forEach((pool: any, i: number) => {
    console.log(`Pool ${i + 1}: ${pool.poolName}`);
    console.log(`  Address: ${pool.address}`);
    pool.tokenAccounts.forEach((ta: any) => {
      console.log(`    - ${ta.uiAmount.toLocaleString()} ${ta.symbol}`);
    });
    console.log('');
  });

  return output;
}

identifyTokens().catch(console.error);
