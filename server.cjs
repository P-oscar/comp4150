// Optional local preview; no packages required. Run: node server.cjs
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assets = new Set(['index.html', 'styles.css', 'config.js', 'data.js', 'service.js', 'app.js']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const port = Number(process.env.RESTAURANT_PREVIEW_PORT || 4150);
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\//, '') || 'index.html'; }
  catch (_) { res.writeHead(400); return res.end('Invalid path'); }
  if (!assets.has(name)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, name), (error, data) => {
    if (error) { res.writeHead(500); return res.end('Unable to read asset'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(name)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.on('error', error => { console.error(`Preview could not start: ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Restaurant preview: http://127.0.0.1:${port}\nKeep this window open. Press Ctrl+C to stop.\nDemo data only; this server does not provide backend APIs.`));
