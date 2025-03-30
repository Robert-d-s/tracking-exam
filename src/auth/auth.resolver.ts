// src/auth/auth.resolver.ts

import { Args, Mutation, Query, Resolver, Context } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { UserProfileDto } from './dto/user-profile.dto';
import { SignInInput } from './dto/sign-in.input';
import { SignUpInput } from './dto/sign-up.input';
import { AuthResponse } from './dto/auth-response';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { LogoutResponse } from './dto/logout-response';
import { GqlContext } from '../app.module';
import { Public } from './public.decorator';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenResponse } from './dto/refresh-token-response';
import { UserRole } from '../user/user-role.enum';

@Resolver()
export class AuthResolver {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private setRefreshTokenCookie(context: GqlContext, token: string): void {
    if (!context?.res) {
      console.error(
        'Response object not found in context, cannot set refresh token cookie.',
      );
      return;
    }
    const refreshExpirationDays = parseInt(
      this.configService
        .get<string>('JWT_REFRESH_EXPIRATION')
        ?.replace('d', '') || '7',
      10,
    );
    const maxAgeMs = refreshExpirationDays * 24 * 60 * 60 * 1000;

    context.res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      maxAge: maxAgeMs,
    });
    console.log('Refresh token cookie set on path /.');
  }

  private clearRefreshTokenCookie(context: GqlContext): void {
    if (!context?.res) {
      console.error(
        'Response object not found in context, cannot clear refresh token cookie.',
      );
      return;
    }
    context.res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    });
    console.log('Refresh token cookie cleared.');
  }

  @Mutation(() => AuthResponse)
  async login(
    @Context() context: GqlContext,
    @Args('input', { nullable: true }) signInInput?: SignInInput,
    @Args('email', { nullable: true }) email?: string,
    @Args('password', { nullable: true }) password?: string,
  ): Promise<Omit<AuthResponse, 'refresh_token'>> {
    const emailToUse = signInInput?.email || email;
    const passwordToUse = signInInput?.password || password;

    if (!emailToUse || !passwordToUse) {
      throw new Error('Email and password are required');
    }

    const { user, accessToken, refreshToken } = await this.authService.signIn(
      emailToUse,
      passwordToUse,
    );

    this.setRefreshTokenCookie(context, refreshToken);

    const result = {
      access_token: accessToken,
      user: new UserProfileDto({
        id: user.id,
        email: user.email,
        role: user.role as UserRole,
      }),
    };
    console.log(
      'AuthResolver.login returning:',
      JSON.stringify(result, null, 2),
    );
    return result;
  }

  @Public()
  @Mutation(() => RefreshTokenResponse)
  async refreshToken(
    @Context() context: GqlContext,
  ): Promise<RefreshTokenResponse> {
    const oldRefreshToken = context.req?.cookies?.['refresh_token'];
    console.log(
      'Refresh endpoint called. Cookie received:',
      oldRefreshToken ? 'Yes' : 'No',
    );

    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh token not found.');
    }

    try {
      const decoded = await this.jwtService.verifyAsync<{ sub: number }>(
        oldRefreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );
      const userId = decoded.sub;

      const { accessToken, refreshToken: newRefreshToken } =
        await this.authService.refreshToken(userId, oldRefreshToken);

      this.setRefreshTokenCookie(context, newRefreshToken);

      return { access_token: accessToken };
    } catch (err) {
      console.error(
        'Refresh token validation or rotation failed:',
        err.message,
      );

      this.clearRefreshTokenCookie(context);
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  @Mutation(() => LogoutResponse)
  @UseGuards(AuthGuard)
  async logout(
    @CurrentUser() user: UserProfileDto,
    @Context() context: GqlContext,
  ): Promise<LogoutResponse> {
    try {
      await this.authService.logout(user.id);
    } catch (error) {
      console.error('Error during server-side logout:', error);
    }

    this.clearRefreshTokenCookie(context);

    return { success: true };
  }

  @Mutation(() => AuthResponse)
  async signup(
    @Context() context: GqlContext,
    @Args('input', { nullable: true }) signUpInput?: SignUpInput,
    @Args('email', { nullable: true }) email?: string,
    @Args('password', { nullable: true }) password?: string,
  ): Promise<Omit<AuthResponse, 'refresh_token'>> {
    const emailToUse = signUpInput?.email || email;
    const passwordToUse = signUpInput?.password || password;

    if (!emailToUse || !passwordToUse) {
      throw new Error('Email and password are required');
    }

    const createdUser = await this.authService.signUp(
      emailToUse,
      passwordToUse,
    );

    const { accessToken, refreshToken } = await this.authService.signIn(
      emailToUse,
      passwordToUse,
    );
    this.setRefreshTokenCookie(context, refreshToken);
    return {
      access_token: accessToken,
      user: new UserProfileDto({
        email: createdUser.email,
        id: createdUser.id,
        role: createdUser.role as UserRole,
      }),
    };
  }

  @Query(() => UserProfileDto)
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: UserProfileDto): Promise<UserProfileDto> {
    return user;
  }
}
