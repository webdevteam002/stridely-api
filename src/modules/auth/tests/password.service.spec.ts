import { PasswordService } from '../services/password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies with argon2id', async () => {
    const hash = await service.hash('SecurePass1');
    expect(hash).toContain('argon2');
    expect(await service.verify(hash, 'SecurePass1')).toBe(true);
    expect(await service.verify(hash, 'wrong')).toBe(false);
  });

  it('rejects weak passwords', () => {
    expect(() => service.assertStrength('short')).toThrow();
    expect(() => service.assertStrength('password123')).toThrow();
    expect(() => service.assertStrength('allletters')).toThrow();
  });
});
