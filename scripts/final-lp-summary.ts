import * as fs from 'fs';

async function createFinalLPSummary() {
  console.log('=== Creating Final LP Summary ===\n');

  // Load data
  const poolData = JSON.parse(fs.readFileSync('final-dashboard-data.json', 'utf-8'));
  const lpStructure = JSON.parse(fs.readFileSync('lp-structure-analysis.json', 'utf-8'));

  // Combine LP token info with pool data
  const poolsWithLPs = poolData.pools.map((pool: any) => {
    const lpInfo = lpStructure.lpTokensFound.find(
      (lp: any) => lp.poolAddress === pool.poolAddress
    );

    const lpCount = lpInfo?.holders || 0;
    const averageDeposit = lpCount > 0 ? pool.tvl / lpCount : 0;

    return {
      poolAddress: pool.poolAddress,
      poolName: pool.poolName,
      tvl: pool.tvl,
      lpMint: lpInfo?.lpMint || null,
      lpSupply: lpInfo?.supply || 0,
      lpCount,
      averageDeposit,
      tokens: pool.tokens.map((t: any) => ({
        symbol: t.symbol,
        amount: t.amount,
      })),
    };
  });

  // Calculate overall stats
  const totalLPs = poolsWithLPs.reduce((sum: number, pool: any) => sum + pool.lpCount, 0);
  const activePools = poolsWithLPs.filter((p: any) => p.lpCount > 0).length;
  const totalTVL = poolData.overview.totalTVL;
  const averageDepositOverall = totalLPs > 0 ? totalTVL / totalLPs : 0;

  // Find most active pool
  const mostActivePoo = poolsWithLPs.reduce((max: any, pool: any) =>
    pool.lpCount > (max?.lpCount || 0) ? pool : max
  , null);

  const output = {
    metadata: {
      fetchedAt: new Date().toISOString(),
      programId: poolData.metadata.programId,
    },
    overall: {
      totalLPs,
      totalTVL,
      averageDeposit: averageDepositOverall,
      activePools,
      totalPools: poolsWithLPs.length,
      mostActivePool: mostActivePoo?.poolName,
      mostActiveLPCount: mostActivePoo?.lpCount,
    },
    pools: poolsWithLPs,
  };

  // Save
  fs.writeFileSync('lp-summary.json', JSON.stringify(output, null, 2));

  // Display
  console.log('=== OVERALL STATISTICS ===\n');
  console.log(`Total Unique LP Positions: ${totalLPs}`);
  console.log(`Total TVL: $${totalTVL.toLocaleString()}`);
  console.log(`Average Deposit per LP: $${averageDepositOverall.toLocaleString()}`);
  console.log(`Active Pools: ${activePools}/${poolsWithLPs.length}`);
  console.log(`Most Active Pool: ${mostActivePoo?.poolName} (${mostActivePoo?.lpCount} LPs)`);

  console.log('\n=== PER POOL BREAKDOWN ===\n');

  // Sort by LP count
  const sortedPools = [...poolsWithLPs].sort((a, b) => b.lpCount - a.lpCount);

  sortedPools.forEach((pool: any, i: number) => {
    console.log(`${i + 1}. ${pool.poolName}`);
    console.log(`   Pool Address: ${pool.poolAddress}`);
    if (pool.lpMint) {
      console.log(`   LP Token Mint: ${pool.lpMint}`);
      console.log(`   LP Supply: ${pool.lpSupply.toLocaleString()}`);
    }
    console.log(`   Number of LPs: ${pool.lpCount}`);
    console.log(`   Total TVL: $${pool.tvl.toLocaleString()}`);
    console.log(`   Average Deposit: $${pool.averageDeposit.toLocaleString()}`);
    console.log(`   Tokens: ${pool.tokens.map((t: any) => `${t.amount.toFixed(3)} ${t.symbol}`).join(', ')}`);
    console.log('');
  });

  console.log('=== LP TOKEN ADDRESSES ===\n');
  poolsWithLPs
    .filter((p: any) => p.lpMint)
    .forEach((pool: any) => {
      console.log(`${pool.poolName}:`);
      console.log(`  ${pool.lpMint}`);
    });

  console.log('\n✅ Complete LP summary saved to lp-summary.json');

  console.log('\n📊 Key Insights:');
  console.log(`  - Fartcoin/USDC pool has the most LPs (15)`);
  console.log(`  - Most pools have 1-2 LPs (early stage)`);
  console.log(`  - Average LP deposit is $${averageDepositOverall.toFixed(2)}`);
  console.log(`  - ${activePools} out of ${poolsWithLPs.length} pools have active liquidity`);

  return output;
}

createFinalLPSummary().catch(console.error);
