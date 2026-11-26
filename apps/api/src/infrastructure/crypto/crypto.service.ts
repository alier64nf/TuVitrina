import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class CryptoService {
  private getKey(): Buffer {
    const hex = process.env.MASTER_ENCRYPTION_KEY?.trim() || '';
    if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
      throw new Error(
        'MASTER_ENCRYPTION_KEY debe ser una clave hexadecimal de 64 caracteres (32 bytes).',
      );
    }
    return Buffer.from(hex, 'hex');
  }

  encryptJson(payload: Record<string, unknown>): string {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  decryptJson<T = Record<string, unknown>>(token: string): T {
    const [ivB64, tagB64, dataB64] = token.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Formato de secreto cifrado inválido.');
    }
    const key = this.getKey();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  }
}
