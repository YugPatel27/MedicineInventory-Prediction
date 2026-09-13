import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const algorithm = 'aes-256-cbc';
const encryptionKeySource = process.env.API_RESPONSE_ENCRYPTION_KEY || '12345678901234567890123456789012';
const encryptionEnabled = process.env.API_RESPONSE_ENCRYPTION_ENABLED !== 'false';
const encryptionKey = Buffer.from(encryptionKeySource.padEnd(32, '0').slice(0, 32), 'utf8');

function encryptPayload(payload) {
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    encryptedData: encrypted.toString('base64'),
    iv: iv.toString('base64')
  };
}

export function responseEncryption(req, res, next) {
  if (!encryptionEnabled) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (!payload || typeof payload !== 'object' || payload.encrypted) {
      return originalJson(payload);
    }

    const isApiRoute = req.path && req.path.startsWith('/api/') && !req.path.startsWith('/api/health');
    if (!isApiRoute) {
      return originalJson(payload);
    }

    try {
      const encryptedPayload = encryptPayload(payload);
      return originalJson({
        encrypted: true,
        algorithm,
        encryptedData: encryptedPayload.encryptedData,
        iv: encryptedPayload.iv,
        encryptedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Response encryption failed:', error);
      return originalJson(payload);
    }
  };

  next();
}
