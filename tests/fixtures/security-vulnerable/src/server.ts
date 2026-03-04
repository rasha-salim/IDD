// Intentionally vulnerable code for testing security rules
// DO NOT use this code in production

import { exec } from 'child_process';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

// Hardcoded secrets (idd-sec-004)
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

// Missing auth on route (idd-sec-003)
app.get('/api/users', (req: Request, res: Response) => {
  // SQL Injection via template literal (idd-sec-002)
  // Data-flow: req.params.id -> userId -> template literal -> db.query()
  const userId = req.params.id;
  const query = `SELECT * FROM users WHERE id = ${userId}`;
  // Also test direct sink detection
  db.query(`SELECT * FROM orders WHERE user_id = ${userId}`);

  res.send('ok');
});

// Command injection (idd-sec-006)
// Data-flow: req.body.command -> command -> template literal -> exec()
app.post('/api/run', (req: Request, res: Response) => {
  const command = req.body.command;
  exec(`ls ${command}`, (error, stdout) => {
    res.send(stdout);
  });
});

// Path traversal (idd-sec-007)
// Data-flow: req.query.path -> fs.readFileSync argument
app.get('/api/files', (req: Request, res: Response) => {
  const filename = req.query.name;
  const content = readFileSync(join('/uploads', req.query.path));
  res.send(content);
});

// Unsafe eval (idd-sec-005)
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

// --- Data-flow test cases ---

// SHOULD be caught: user input flows through variable chain to SQL sink
app.post('/api/search', (req: Request, res: Response) => {
  const searchTerm = req.body.search;
  const filter = searchTerm;
  const sqlQuery = `SELECT * FROM products WHERE name LIKE ${filter}`;
  db.query(sqlQuery);
  res.send('ok');
});

// SHOULD NOT be caught: constant value flows to SQL (no user input)
function getDefaultUsers() {
  const tableName = 'users';
  const defaultQuery = `SELECT * FROM ${tableName} WHERE active = true`;
  return defaultQuery;
}

// SHOULD be caught: destructured user input flows to command
app.post('/api/process', (req: Request, res: Response) => {
  const { filename } = req.body;
  exec(`cat ${filename}`, (error, stdout) => {
    res.send(stdout);
  });
});

// SHOULD NOT be caught: path.resolve is used (mitigation detected)
app.get('/api/safe-files', (req: Request, res: Response) => {
  const userPath = req.query.path;
  const safePath = resolve('/uploads', userPath);
  const content = readFileSync(safePath);
  res.send(content);
});
