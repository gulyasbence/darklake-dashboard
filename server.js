const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let isRefreshing = false;

app.post('/api/refresh', (req, res) => {
  if (isRefreshing) {
    return res.status(429).json({ error: 'Refresh already in progress' });
  }

  isRefreshing = true;
  console.log('Starting data refresh...');

  const refresh = spawn('pnpm', ['run', 'refresh'], {
    cwd: __dirname,
    shell: true,
  });

  let output = '';
  let errorOutput = '';

  refresh.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log(text);
  });

  refresh.stderr.on('data', (data) => {
    const text = data.toString();
    errorOutput += text;
    console.error(text);
  });

  refresh.on('close', (code) => {
    isRefreshing = false;
    console.log(`Refresh completed with code ${code}`);

    if (code === 0) {
      res.json({
        success: true,
        message: 'Data refreshed successfully',
        output: output,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Refresh failed',
        output: output,
        errorOutput: errorOutput,
      });
    }
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    isRefreshing,
  });
});

app.listen(PORT, () => {
  console.log(`Dashboard server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
