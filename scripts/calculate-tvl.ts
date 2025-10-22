import * as fs from 'fs';

// Jupiter Price API
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';

interface TokenPrice {
  id: string;
  price: number;
}

interface PoolWithTVL {
  address: string;
  tvl: number;
  tokens: Array<{
    symbol: string;
    amount: number;
    price: number;
    value: number;
  }>;
}

async function fetchPrices(mints: string[]): Promise<Map<string, number>> {
  console.log(`Using hardcoded prices (price API integration needed)...\n`);

  const prices = new Map<string, number>();

  // Hardcoded prices for common tokens (update these manually or integrate a working price API)
  const knownPrices: Record<string, { price: number; symbol: string }> = {
    'So11111111111111111111111111111111111111112': { price: 150, symbol: 'SOL' },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { price: 1.0, symbol: 'USDC' },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { price: 1.0, symbol: 'USDT' },
  };

  for (const mint of mints) {
    if (knownPrices[mint]) {
      prices.set(mint, knownPrices[mint].price);
      console.log(`  ${knownPrices[mint].symbol} (${mint.substring(0, 8)}...): $${knownPrices[mint].price}`);
    } else {
      prices.set(mint, 0);
      console.log(`  Unknown token (${mint.substring(0, 8)}...): Price not available`);
    }
  }

  return prices;
}

async function calculateTVL() {
  console.log('=== Darklake TVL Calculator ===\n');

  // Load pool data
  const poolData = JSON.parse(
    fs.readFileSync('pool-data-manual.json', 'utf-8')
  );

  console.log(`Loaded ${poolData.pools.length} pools\n`);

  // Collect all unique mints
  const mints = new Set<string>();
  poolData.pools.forEach((pool: any) => {
    pool.tokenAccounts.forEach((ta: any) => {
      mints.add(ta.mint);
    });
  });

  console.log(`Found ${mints.size} unique token mints\n`);

  // Fetch prices
  const prices = await fetchPrices(Array.from(mints));

  console.log('\n=== Calculating TVL ===\n');

  const poolsWithTVL: PoolWithTVL[] = [];
  let totalTVL = 0;

  poolData.pools.forEach((pool: any, index: number) => {
    console.log(`\nPool ${index + 1}: ${pool.address}`);

    let poolTVL = 0;
    const tokens: any[] = [];

    pool.tokenAccounts.forEach((ta: any) => {
      const decimals = ta.decimals || 9;
      const amount = parseInt(ta.amount) / Math.pow(10, decimals);
      const price = prices.get(ta.mint) || 0;
      const value = amount * price;

      poolTVL += value;

      console.log(`  ${ta.mintSymbol || 'UNKNOWN'}`);
      console.log(`    Amount: ${amount.toLocaleString()}`);
      console.log(`    Price: $${price.toFixed(4)}`);
      console.log(`    Value: $${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

      tokens.push({
        symbol: ta.mintSymbol || 'UNKNOWN',
        amount,
        price,
        value,
      });
    });

    console.log(`  Pool TVL: $${poolTVL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

    poolsWithTVL.push({
      address: pool.address,
      tvl: poolTVL,
      tokens,
    });

    totalTVL += poolTVL;
  });

  console.log('\n\n=== SUMMARY ===\n');
  console.log(`Total TVL: $${totalTVL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Number of Pools: ${poolsWithTVL.length}`);
  console.log(`Average Pool TVL: $${(totalTVL / poolsWithTVL.length).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  // Save results
  const output = {
    calculatedAt: new Date().toISOString(),
    totalTVL,
    poolCount: poolsWithTVL.length,
    pools: poolsWithTVL,
  };

  fs.writeFileSync('tvl-data.json', JSON.stringify(output, null, 2));
  console.log('\n✅ TVL data saved to tvl-data.json');

  return output;
}

calculateTVL().catch(console.error);
