import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthUser } from '../decorators/current-user.decorator';
import {
  AnonymousDto,
  GuestUpgradeDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  RegisterDto,
  SocialAuthStubDto,
  TrustDeviceDto,
} from '../dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Register with email + password' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(
      {
        email: dto.email,
        password: dto.password,
        displayName: dto.displayName,
      },
      {
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        platform: dto.platform,
        appVersion: dto.appVersion,
        pushToken: dto.pushToken,
      },
      this.meta(req),
    );
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with email + password' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(
      { email: dto.email, password: dto.password },
      {
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        platform: dto.platform,
        appVersion: dto.appVersion,
        pushToken: dto.pushToken,
      },
      this.meta(req),
    );
  }

  @Post('anonymous')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create or resume anonymous local user (offline-first)',
  })
  anonymous(@Body() dto: AnonymousDto, @Req() req: Request) {
    return this.auth.anonymousLocal(
      { anonymousKey: dto.anonymousKey, displayName: dto.displayName },
      {
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        platform: dto.platform,
        appVersion: dto.appVersion,
        pushToken: dto.pushToken,
      },
      this.meta(req),
    );
  }

  @Post('guest/upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade anonymous guest to email account' })
  upgrade(
    @CurrentUser() user: AuthUser,
    @Body() dto: GuestUpgradeDto,
    @Req() req: Request,
  ) {
    return this.auth.upgradeGuest(
      user.userId,
      {
        email: dto.email,
        password: dto.password,
        displayName: dto.displayName,
      },
      {
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        platform: dto.platform,
        appVersion: dto.appVersion,
        pushToken: dto.pushToken,
      },
      this.meta(req),
    );
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token(s)' })
  logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutDto) {
    return this.auth.logout(user.userId, dto.refreshToken, dto.revokeAll);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List trusted devices for current user' })
  devices(@CurrentUser() user: AuthUser) {
    return this.auth.listDevices(user.userId);
  }

  @Delete('devices/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a device session' })
  revokeDevice(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.auth.revokeDevice(user.userId, id);
  }

  @Post('device/trust')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark a device as trusted' })
  trust(@CurrentUser() user: AuthUser, @Body() dto: TrustDeviceDto) {
    return this.auth.trustDevice(user.userId, dto.deviceRowId);
  }

  @Post('oauth/apple')
  @HttpCode(501)
  @ApiOperation({
    summary: 'Apple Sign-In (future)',
    description: 'Placeholder — not implemented in S6-T04',
  })
  appleStub(@Body() _dto: SocialAuthStubDto) {
    return {
      code: 'NOT_IMPLEMENTED',
      message: 'Apple Sign-In will be available in a future sprint',
    };
  }

  @Post('oauth/google')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sign in or register with Google' })
  googleLogin(@Body() dto: SocialAuthStubDto, @Req() req: Request) {
    return this.auth.googleSignIn(
      { idToken: dto.identityToken, displayName: dto.displayName },
      {
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        platform: dto.platform,
        appVersion: dto.appVersion,
        pushToken: dto.pushToken,
      },
      this.meta(req),
    );
  }

  @Post('passkeys/register')
  @HttpCode(501)
  @ApiOperation({ summary: 'Passkey registration (future)' })
  passkeyStub() {
    return {
      code: 'NOT_IMPLEMENTED',
      message: 'Passkeys will be available in a future sprint',
    };
  }

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'] as string | undefined,
    };
  }
}
