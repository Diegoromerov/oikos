import * as crypto from 'crypto';

export interface EncryptionConfig {
  algorithm: string;
  key: Buffer;
  ivLength: number;
}

export class EncryptionService {
  private readonly config: EncryptionConfig;

  constructor() {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY environment variable is required but not defined');
    }

    this.config = {
      algorithm: 'aes-256-gcm',
      key: crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32),
      ivLength: 16,
    };
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(this.config.ivLength);
    const cipher = crypto.createCipheriv(this.config.algorithm, this.config.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = (cipher as any).getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.config.algorithm, this.config.key, iv);
    (decipher as any).setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  encryptObject(obj: Record<string, any>): Record<string, any> {
    const encrypted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        encrypted[key] = this.encrypt(value);
      } else if (typeof value === 'object' && value !== null) {
        encrypted[key] = this.encryptObject(value);
      } else {
        encrypted[key] = value;
      }
    }
    return encrypted;
  }

  decryptObject(obj: Record<string, any>): Record<string, any> {
    const decrypted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.includes(':') && value.split(':').length === 3) {
        try {
          decrypted[key] = this.decrypt(value);
        } catch {
          decrypted[key] = value;
        }
      } else if (typeof value === 'object' && value !== null) {
        decrypted[key] = this.decryptObject(value);
      } else {
        decrypted[key] = value;
      }
    }
    return decrypted;
  }
}

export const encryptionService = new EncryptionService();