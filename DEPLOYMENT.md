# Darklake Dashboard - Deployment Guide

## Auto-Refresh Setup (Every 8 Hours)

Your dashboard now automatically refreshes data every 8 hours using GitHub Actions.

### Step 1: Push to GitHub

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit with auto-refresh"

# Create a new GitHub repository, then:
git remote add origin https://github.com/YOUR_USERNAME/darklake-dashboard.git
git branch -M main
git push -u origin main
```

### Step 2: Add RPC Endpoint Secret

1. Go to your GitHub repository
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add:
   - Name: `RPC_ENDPOINT`
   - Value: Your Solana RPC endpoint (from your `.env` file)

### Step 3: Deploy to Vercel (Free)

#### Option A: Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts, then deploy to production
vercel --prod
```

#### Option B: Using Vercel Website
1. Go to [vercel.com](https://vercel.com)
2. Click **Import Project**
3. Connect your GitHub repository
4. Click **Deploy**

That's it! Your dashboard will be live at `https://your-project.vercel.app`

## How It Works

1. **GitHub Actions** runs every 8 hours (00:00, 08:00, 16:00 UTC)
2. It runs `pnpm run refresh` to update the JSON files
3. Commits the updated data back to the repository
4. **Vercel** detects the commit and automatically redeploys (takes ~30 seconds)
5. Your team always sees data that's max 8 hours old

## Manual Refresh

You can manually trigger a refresh:
- **GitHub**: Go to Actions tab > "Refresh Dashboard Data" > Run workflow
- **Local**: Run `pnpm run refresh` and push changes

## Customizing Refresh Interval

Edit `.github/workflows/refresh-data.yml`:

```yaml
schedule:
  # Every 4 hours
  - cron: '0 */4 * * *'

  # Every hour
  - cron: '0 * * * *'

  # Every 12 hours
  - cron: '0 */12 * * *'

  # Daily at 9 AM UTC
  - cron: '0 9 * * *'
```

## Cost

- **GitHub Actions**: Free (2,000 minutes/month)
- **Vercel**: Free tier (100 GB bandwidth, unlimited deployments)
- **Total**: $0/month

## Monitoring

- Check GitHub Actions tab to see if refreshes are running successfully
- Each refresh takes ~30-60 seconds depending on RPC endpoint speed
- Vercel will auto-deploy within ~30 seconds of data updates

## Troubleshooting

**If refresh fails:**
1. Check GitHub Actions logs
2. Verify `RPC_ENDPOINT` secret is set correctly
3. Check if RPC endpoint has rate limits

**If Vercel doesn't update:**
1. Check if git commit was successful in GitHub
2. Vercel should auto-deploy on every commit
3. Check Vercel deployment logs
