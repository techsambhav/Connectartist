/**
 * utils/credCrypto.js
 * AES-256-CBC encryption/decryption helpers for storing admin-created
 * artist credentials in the database.
 *
 * Encryption key is read from CRED_CRYPTO_SECRET (must be exactly 32 chars)
 * or falls back to deriving 32 bytes from JWT_SECRET.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

/**
 * Return a stable 32-byte key derived from the environment.
 */
function getKey() {
  const raw = process.env.CRED_CRYPTO_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-me-please!';
  // Derive a fixed-length 32-byte key via SHA-256 so any string length works.
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns a hex string: <iv_hex>:<ciphertext_hex>
 */
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a string previously encrypted by encrypt().
 * Expects format: <iv_hex>:<ciphertext_hex>
 */
function decrypt(encryptedText) {
  const [ivHex, ciphertextHex] = encryptedText.split(':');
  if (!ivHex || !ciphertextHex) throw new Error('Invalid encrypted format');
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
