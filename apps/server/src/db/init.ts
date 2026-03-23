import fs from 'fs';
import path from 'path';
import db from '../config/db';

const schema = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Add email verification columns to existing DBs (idempotent)
try {
  db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`);
} catch (_) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN verification_token TEXT`);
} catch (_) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT`);
} catch (_) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN reset_token_expires TEXT`);
} catch (_) { /* column already exists */ }

console.log('Database schema initialized successfully');
db.close();
