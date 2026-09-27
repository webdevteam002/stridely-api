import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('exposes ping and can skip connect', async () => {
    const previous = process.env.SKIP_DB_CONNECT;
    process.env.SKIP_DB_CONNECT = 'true';
    const prisma = new PrismaService();
    expect(typeof prisma.ping).toBe('function');
    const connectSpy = jest
      .spyOn(prisma, '$connect')
      .mockResolvedValue(undefined);
    await prisma.onModuleInit();
    expect(connectSpy).not.toHaveBeenCalled();
    process.env.SKIP_DB_CONNECT = previous;
  });
});
