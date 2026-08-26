const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, 'frontend');
const sessions = new Map();
const seed = [{ title: 'Rain garden survey', body: 'Three plots checked after the morning storm.', owner: 'Mara Chen' }, { title: 'Transit shelter sketch', body: 'Confirm sightline with the eastbound route team.', owner: 'Ivo Singh' }];
function getSession(request) {
  const id = request.headers.cookie?.match(/fixture_session=([^;]+)/)?.[1];
  return id ? sessions.get(id) : undefined;
}
function json(response, status, value, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  response.end(JSON.stringify(value));
}
http.createServer((request, response) => {
  if (request.url === '/api/fixture-session' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => {
      const input = JSON.parse(body);
      const authorized = input.state === 'authenticated';
      const role = authorized && input.role === 'viewer' ? 'viewer' : authorized ? 'editor' : 'unauthorized';
      const id = crypto.randomUUID();
      sessions.set(id, { authorized, role });
      json(response, 200, { authorized, role, canCreate: authorized && role === 'editor' }, { 'set-cookie': `fixture_session=${id}; HttpOnly; SameSite=Strict; Path=/` });
    });
    return;
  }
  if (request.url === '/api/sign-out' && request.method === 'POST') {
    const id = request.headers.cookie?.match(/fixture_session=([^;]+)/)?.[1];
    if (id) sessions.delete(id);
    json(response, 200, { signedOut: true }, { 'set-cookie': 'fixture_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    return;
  }
  if (request.url.startsWith('/api/notes?failure=1')) { response.destroy(); return; }
  if (request.url === '/api/notes' && request.method === 'GET') {
    const session = getSession(request);
    if (!session?.authorized) { json(response, 403, { error: 'forbidden' }); return; }
    json(response, 200, seed);
    return;
  }
  if (request.url === '/api/notes/new' && request.method === 'POST') {
    const session = getSession(request);
    if (!session?.authorized || session.role !== 'editor') { json(response, 403, { error: 'forbidden' }); return; }
    json(response, 200, { opened: true });
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(fs.readFileSync(path.join(root, 'index.html')));
}).listen(4178, '127.0.0.1', () => console.log('fixture server listening on 4178'));
