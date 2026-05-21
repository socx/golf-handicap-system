const http = require('node:http');

const port = Number(process.env.API_PORT || process.env.PORT || 3005);

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  if (url === '/health' || url === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'ghs-api', timestamp: new Date().toISOString() }));
    return;
  }

  if (url.startsWith('/api/')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'API bootstrap route', path: url }));
    return;
  }

  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ message: 'ghs-api running', health: '/health', apiHealth: '/api/health' }));
});

server.listen(port, () => {
  console.log(`ghs-api listening on http://localhost:${port}`);
});
