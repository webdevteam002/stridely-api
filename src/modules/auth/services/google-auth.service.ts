import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type GoogleTokenPayload = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

type GoogleTokenInfoResponse = {
  aud?: string;
  azp?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
};

@Injectable()
export class GoogleAuthService {
  constructor(private readonly config: ConfigService) {}

  async verifyIdToken(idToken: string): Promise<GoogleTokenPayload> {
    const clientId = this.config.get<string>('auth.googleClientId');
    if (!clientId) {
      throw new BadRequestException({
        code: 'GOOGLE_NOT_CONFIGURED',
        message: 'Google Sign-In is not configured on the server',
      });
    }

    const url =
      'https://oauth2.googleapis.com/tokeninfo?id_token=' +
      encodeURIComponent(idToken);
    const response = await fetch(url);
    const payload = (await response.json()) as GoogleTokenInfoResponse;

    if (!response.ok || payload.error) {
      throw new UnauthorizedException({
        code: 'INVALID_GOOGLE_TOKEN',
        message: payload.error_description ?? 'Invalid Google identity token',
      });
    }

    const audienceOk =
      payload.aud === clientId ||
      payload.azp === clientId ||
      (payload.aud != null && payload.aud.includes(clientId));
    if (!audienceOk) {
      throw new UnauthorizedException({
        code: 'GOOGLE_AUDIENCE_MISMATCH',
        message: 'Google token audience does not match configured client',
      });
    }

    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException({
        code: 'GOOGLE_PROFILE_INCOMPLETE',
        message: 'Google token is missing required profile fields',
      });
    }

    const emailVerified =
      payload.email_verified === true ||
      payload.email_verified === 'true';

    return {
      sub: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
