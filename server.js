const http = require('http');
const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const webDir = path.join(baseDir, 'web');
const weeklyGenerated = path.join(baseDir, 'data', 'weekly.generated.json');
const monthlyGenerated = path.join(baseDir, 'data', 'monthly.generated.json');
const weeklyData = path.join(baseDir, 'data', 'weekly.json');
const monthlyData = path.join(baseDir, 'data', 'monthly.json');

function send(res, status, body, type = 'text/plain') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function serveStatic(req, res) {
  const safePath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(webDir, safePath);

  if (!filePath.startsWith(webDir)) {
    return send(res, 403, 'Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html'
      : ext === '.css' ? 'text/css'
      : ext === '.js' ? 'application/javascript'
      : 'application/octet-stream';
    send(res, 200, data, type);
  });
}

function serveApi(req, res) {
  if (req.url.startsWith('/api/summary')) {
    const url = new URL(req.url, 'http://localhost');
    const period = (url.searchParams.get('period') || 'weekly').toLowerCase();

    const chosen = period === 'monthly'
      ? (fs.existsSync(monthlyGenerated) ? monthlyGenerated : monthlyData)
      : (fs.existsSync(weeklyGenerated) ? weeklyGenerated : weeklyData);

    fs.readFile(chosen, 'utf8', (err, raw) => {
      if (err) return send(res, 500, 'Data error');
      send(res, 200, raw, 'application/json');
    });
    return;
  }

  send(res, 404, 'Not found');
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return serveApi(req, res);
  return serveStatic(req, res);
});

const port = process.env.PORT || 3000;
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => {
  console.log(`Endpoint dashboard running on http://${host}:${port}`);
});
