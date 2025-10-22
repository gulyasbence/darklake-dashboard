export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get GitHub token from environment variable
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (!GITHUB_TOKEN) {
      return res.status(500).json({
        error: 'GitHub token not configured',
        message: 'Please add GITHUB_TOKEN to Vercel environment variables'
      });
    }

    // Trigger GitHub Actions workflow
    const response = await fetch(
      'https://api.github.com/repos/gulyasbence/darklake-dashboard/actions/workflows/refresh-data.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({
        error: 'Failed to trigger workflow',
        details: error
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Data refresh triggered! The page will reload automatically in about 2 minutes.',
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
