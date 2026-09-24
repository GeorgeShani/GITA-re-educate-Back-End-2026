import { Body, Controller, Get, Headers, HttpCode, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '#/common/auth/current-user.decorator.js';
import { Public } from '#/common/auth/public.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { MessageResponseDto } from '#/common/response/message-response.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import { CompanyDto } from '#/companies/dto/company.dto.js';
import { UserProfileDto } from '#/users/dto/user-profile.dto.js';
import { UsersService } from '#/users/users.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { EmailOnlyDto } from './dto/email-only.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { MeDto } from './dto/me.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterCompanyResponseDto } from './dto/register-company-response.dto.js';
import { RegisterCompanyDto } from './dto/register-company.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SessionDto } from './dto/session.dto.js';
import { TokenQueryDto } from './dto/token-query.dto.js';
import { PasswordService } from './password.service.js';
import { RegistrationService } from './registration.service.js';
import { SessionService } from './session.service.js';

/**
 * The email-flow endpoints answer identically whether or not the address
 * exists — they never confirm an account is there.
 */
const IF_ACCOUNT_EXISTS = 'If that account exists, an email is on its way.';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registration: RegistrationService,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Post('register-company')
  @ApiCreatedResponse({ type: RegisterCompanyResponseDto })
  async registerCompany(@Body() dto: RegisterCompanyDto): Promise<RegisterCompanyResponseDto> {
    const { companyId, userId } = await this.registration.registerCompany(dto);
    return toDto(RegisterCompanyResponseDto, {
      companyId,
      userId,
      status: 'pending_activation',
      message: 'Check your inbox to activate your account.',
    });
  }

  @Public()
  @Get('activate')
  @ApiOkResponse({ type: MessageResponseDto })
  async activate(@Query() query: TokenQueryDto): Promise<MessageResponseDto> {
    await this.registration.activate(query.token);
    return toDto(MessageResponseDto, { message: 'Your account is active. You can sign in now.' });
  }

  @Public()
  @Post('resend-activation')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageResponseDto })
  async resendActivation(@Body() dto: EmailOnlyDto): Promise<MessageResponseDto> {
    await this.registration.resendActivation(dto.email);
    return toDto(MessageResponseDto, { message: IF_ACCOUNT_EXISTS });
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: SessionDto })
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<SessionDto> {
    return toDto(SessionDto, await this.sessions.login(dto, { userAgent }));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOkResponse({ type: SessionDto })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<SessionDto> {
    return toDto(SessionDto, await this.sessions.refresh(dto.refreshToken, { userAgent }));
  }

  /** `@Public()`: the access token is often already expired by the time someone logs out. */
  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(@Body() dto: RefreshTokenDto): Promise<MessageResponseDto> {
    await this.sessions.logout(dto.refreshToken);
    return toDto(MessageResponseDto, { message: 'Signed out.' });
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageResponseDto })
  async forgotPassword(@Body() dto: EmailOnlyDto): Promise<MessageResponseDto> {
    await this.passwords.forgot(dto.email);
    return toDto(MessageResponseDto, { message: IF_ACCOUNT_EXISTS });
  }

  @Public()
  @Post('password/reset')
  @HttpCode(200)
  @ApiOkResponse({ type: MessageResponseDto })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    await this.passwords.reset(dto.token, dto.newPassword);
    return toDto(MessageResponseDto, {
      message: 'Your password has been reset. Sign in with the new one.',
    });
  }

  @Roles('admin', 'employee')
  @ApiBearerAuth()
  @Patch('password')
  @ApiOkResponse({ type: SessionDto })
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<SessionDto> {
    return toDto(SessionDto, await this.passwords.change(userId, dto, { userAgent }));
  }

  @Roles('admin', 'employee')
  @ApiBearerAuth()
  @Get('me')
  @ApiOkResponse({ type: MeDto })
  async me(@CurrentUser('userId') userId: string): Promise<MeDto> {
    const { user, company } = await this.users.profile(userId);
    return toDto(MeDto, { user: UserProfileDto.from(user), company: CompanyDto.from(company) });
  }
}
