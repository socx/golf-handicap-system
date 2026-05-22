import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { HealthStatusResponse } from '@ghs/types';

const port = Number(process.env.WEB_PORT || 5175);

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GHS Web Bootstrap</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; margin: 2rem; }
      code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>GHS Web Bootstrap Running</h1>
    <p>Web URL: <code>http://localhost:${port}</code></p>
    <p>Expected API URL: <code>http://localhost:3005/api/health</code></p>
  </body>
</html>`;

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if ((req.url || '/') === '/health') {
    const payload: HealthStatusResponse = {
      status: 'ok',
      service: 'ghs-web',
      timestamp: new Date().toISOString(),
    };

    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(payload));
    return;
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}

createServer(handleRequest).listen(port, () => {
  console.log(`ghs-web listening on http://localhost:${port}`);
});
