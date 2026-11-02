const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Generate encryption key from JWT_SECRET
const getEncryptionKey = () => {
  const secret = process.env.JWT_SECRET || 'bikemate_secure_default_secret_key_2026';
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Generate a random 4-digit boarding PIN
 */
const generatePin = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Hash PIN for secure verification in database (one-way bcrypt)
 */
const hashPin = async (pin) => {
  return await bcrypt.hash(pin.toString().trim(), 10);
};

/**
 * Verify entered PIN against bcrypt hash
 */
const verifyPin = async (enteredPin, hashedPin) => {
  if (!enteredPin || !hashedPin) return false;
  return await bcrypt.compare(enteredPin.toString().trim(), hashedPin);
};

/**
 * Reversibly encrypt PIN so ONLY the authorized commuter can retrieve it on page refresh
 * Uses AES-256-CBC with random IV
 */
const encryptPin = (pin) => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(pin.toString().trim(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('PIN encryption error:', err);
    return null;
  }
};

/**
 * Decrypt PIN for authorized commuter display
 */
const decryptPin = (encryptedStr) => {
  try {
    if (!encryptedStr || !encryptedStr.includes(':')) return null;
    const [ivHex, encrypted] = encryptedStr.split(':');
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('PIN decryption error:', err);
    return null;
  }
};

module.exports = {
  generatePin,
  hashPin,
  verifyPin,
  encryptPin,
  decryptPin
};
