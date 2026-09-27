import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AccessTokenPayload } from '../services/token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('auth.jwtSecret'),
      issuer: config.get<string>('auth.issuer', 'stridely-api'),
      audience: config.get<string>('auth.audience', 'stridely-app'),
    });
  }

  validate(payload: AccessTokenPayload) {
    if (payload.typ !== 'access') {
      return null;
    }
    return {
      userId: payload.sub,
      deviceId: payload.deviceId,
      deviceRowId: payload.deviceRowId,
      accountType: payload.accountType,
    };
  }
}
