import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { DeviceService } from './services/device.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';
import { TokenService } from './services/token.service';
import { GoogleAuthService } from './services/google-auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('auth.jwtSecret'),
        signOptions: {
          issuer: config.get<string>('auth.issuer', 'stridely-api'),
          audience: config.get<string>('auth.audience', 'stridely-app'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    DeviceService,
    SessionService,
    JwtStrategy,
    GoogleAuthService,
  ],
  exports: [AuthService, TokenService, DeviceService, JwtModule],
})
export class AuthModule {}
