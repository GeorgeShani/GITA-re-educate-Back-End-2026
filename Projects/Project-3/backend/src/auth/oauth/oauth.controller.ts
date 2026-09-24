import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Redirect,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '#/common/auth/current-user.decorator.js';
import { Public } from '#/common/auth/public.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { MessageResponseDto } from '#/common/response/message-response.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { SessionDto } from '../dto/session.dto.js';
import { GoogleUrlDto, OAuthUrlDto } from './dto/google-url.dto.js';
import { IdentityDto, IdentityListDto } from './dto/identity.dto.js';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto.js';
import {
  OAuthRegisterCompanyDto,
  OAuthRegisterCompanyResponseDto,
  OAuthRegistrationPreviewDto,
  OAuthRegistrationTokenDto,
} from './dto/oauth-registration.dto.js';
import { IdentitiesService } from './identities.service.js';
import { OAUTH_NONCE_COOKIE, nonceCookieOptions, readCookie } from './oauth-cookie.js';
import { OAuthRegistrationService } from './oauth-registration.service.js';
import { type OAuthStart, OAuthService } from './oauth.service.js';

/**
 * Google sign-in and linked accounts. The callback is the only route in the API a
 * browser is navigated to by a third party, so it alone answers with redirects.
 */
@ApiTags('auth')
@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly registration: OAuthRegistrationService,
    private readonly identities: IdentitiesService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('oauth/google/url')
  @HttpCode(200)
  @ApiOkResponse({ type: OAuthUrlDto })
  async googleUrl(
    @Body() dto: GoogleUrlDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OAuthUrlDto> {
    return this.startedFlow(await this.oauth.start(dto), res);
  }

  @Public()
  @Get('google/callback')
  @Redirect()
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'error', required: false })
  @ApiResponse({ status: 302, description: 'Redirects the browser to the web app.' })
  async googleCallback(
    @Query() query: Record<string, unknown>,
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ url: string; statusCode: number }> {
    const result = await this.oauth.handleCallback(query, readCookie(cookie, OAUTH_NONCE_COOKIE));
    // One-shot: whatever the outcome, this flow is over.
    res.clearCookie(OAUTH_NONCE_COOKIE, nonceCookieOptions(this.config.isProduction));
    return { url: result.redirect, statusCode: 302 };
  }

  @Public()
  @Post('oauth/exchange')
  @HttpCode(200)
  @ApiOkResponse({ type: SessionDto })
  async exchange(
    @Body() dto: OAuthExchangeDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<SessionDto> {
    return toDto(SessionDto, await this.oauth.exchange(dto.code, { userAgent }));
  }

  @Public()
  @Post('oauth/registration/preview')
  @HttpCode(200)
  @ApiOkResponse({ type: OAuthRegistrationPreviewDto })
  async registrationPreview(
    @Body() dto: OAuthRegistrationTokenDto,
  ): Promise<OAuthRegistrationPreviewDto> {
    return toDto(OAuthRegistrationPreviewDto, await this.registration.preview(dto.oauthRegistrationToken));
  }

  @Public()
  @Post('oauth/register-company')
  @ApiCreatedResponse({ type: OAuthRegisterCompanyResponseDto })
  async registerCompany(
    @Body() dto: OAuthRegisterCompanyDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<OAuthRegisterCompanyResponseDto> {
    const registered = await this.registration.register(dto, { userAgent });
    return toDto(OAuthRegisterCompanyResponseDto, {
      ...registered,
      message:
        registered.status === 'active'
          ? 'Your company is active. You are signed in.'
          : 'Check your inbox to activate your account.',
    });
  }

  @Roles('admin', 'employee')
  @ApiBearerAuth()
  @Post('identities/google/link')
  @HttpCode(200)
  @ApiOkResponse({ type: OAuthUrlDto })
  async linkGoogle(
    @CurrentUser('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OAuthUrlDto> {
    return this.startedFlow(await this.oauth.startLink(userId), res);
  }

  @Roles('admin', 'employee')
  @ApiBearerAuth()
  @Get('identities')
  @ApiOkResponse({ type: IdentityListDto })
  async listIdentities(@CurrentUser('userId') userId: string): Promise<IdentityListDto> {
    const found = await this.identities.list(userId);
    return toDto(IdentityListDto, { data: found.map((identity) => IdentityDto.from(identity)) });
  }

  @Roles('admin', 'employee')
  @ApiBearerAuth()
  @Delete('identities/:id')
  @ApiOkResponse({ type: MessageResponseDto })
  async unlinkIdentity(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MessageResponseDto> {
    await this.identities.unlink(userId, id);
    return toDto(MessageResponseDto, { message: 'Sign-in method removed.' });
  }

  private startedFlow(start: OAuthStart, res: Response): OAuthUrlDto {
    res.cookie(OAUTH_NONCE_COOKIE, start.nonce, nonceCookieOptions(this.config.isProduction));
    return toDto(OAuthUrlDto, { url: start.url });
  }
}
