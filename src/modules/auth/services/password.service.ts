import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

const WEAK_PATTERNS = [
  /^password/i,
  /^123456/,
  /^qwerty/i,
  /^stridely/i,
];

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    this.assertStrength(password);
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  assertStrength(password: string): void {
    if (password.length < 8) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password must be at least 8 characters',
      });
    }
    if (password.length > 128) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password must be at most 128 characters',
      });
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password must include letters and numbers',
      });
    }
    if (WEAK_PATTERNS.some((p) => p.test(password))) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'Password is too common',
      });
    }
  }
}
