import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service.js';
import { LoginInput } from './dto/login.input.js';
import { RegisterInput } from './dto/register.input.js';
import { AuthPayload } from './types/auth-payload.type.js';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload)
  register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @Mutation(() => AuthPayload)
  login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input);
  }
}
