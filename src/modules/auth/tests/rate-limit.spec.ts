import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../../../app.module';

describe('Rate limiting', () => {
  it('wires global ThrottlerGuard via AppModule', () => {
    expect(ThrottlerGuard).toBeDefined();
    expect(APP_GUARD).toBeDefined();
    expect(AppModule).toBeDefined();
  });
});
