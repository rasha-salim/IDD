// Intentionally vulnerable code for testing security rules
// DO NOT use this code in production

import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

// Hardcoded secrets (cmiw-sec-004)
const apiKey = "sk_live_abcdefghijklmnopqrstuvwxyz1234567890";
const password = "SuperSecretPassword123!@#";

// Fake Express-like types for testing
interface Request { body: any; query: any; params: any; }
interface Response { send: (data: any) => void; json: (data: any) => void; }
interface App {
  get: (path: string, handler: (req: Request, res: Response) => void) => void;
  post: (path: string, handler: (req: Request, res: Response) => void) => void;
}

declare const app: App;
declare const db: { query: (sql: string) => Promise<any> };

// Missing auth on route (cmiw-sec-003)
app.get('/api/users', (req: Request, res: Response) => {
  // SQL Injection via template literal (cmiw-sec-002)
  const userId = req.params.id;
  const query = `SELECT * FROM users WHERE id = ${userId}`;
  db.query(query);

  res.send('ok');
});

// Command injection (cmiw-sec-006)
app.post('/api/run', (req: Request, res: Response) => {
  const command = req.body.command;
  exec(`ls ${command}`, (error, stdout) => {
    res.send(stdout);
  });
});

// Path traversal (cmiw-sec-007)
app.get('/api/files', (req: Request, res: Response) => {
  const filename = req.query.name;
  const content = readFileSync(join('/uploads', req.query.path));
  res.send(content);
});

// Unsafe eval (cmiw-sec-005)
function processInput(input: string) {
  const result = eval(input);
  return result;
}

// Unsafe innerHTML
function renderContent(html: string) {
  const el = document.getElementById('content');
  if (el) {
    el.innerHTML = html;
  }
}
