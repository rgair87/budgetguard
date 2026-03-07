import { query } from '../config/database.js';
import { env } from '../config/env.js';

export async function encrypt(plaintext: string): Promise<Buffer> {
  const result = await query<{ encrypted: Buffer }>(
    `SELECT pgp_sym_encrypt($1, $2, 'cipher-algo=aes256') AS encrypted`,
    [plaintext, env.DB_ENCRYPTION_KEY]
  );
  return result.rows[0].encrypted;
}

export async function decrypt(ciphertext: Buffer): Promise<string> {
  const result = await query<{ decrypted: string }>(
    `SELECT pgp_sym_decrypt($1, $2) AS decrypted`,
    [ciphertext, env.DB_ENCRYPTION_KEY]
  );
  return result.rows[0].decrypted;
}
