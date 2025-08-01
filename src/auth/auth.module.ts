import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthResolver } from './auth.resolver';
import { AuthGuard } from './auth.guard';
import { TokenBlacklistService } from './token-blacklist.service';
import { TokenService } from './token.service';
import { JwtCacheService } from './jwt-cache.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [
    AuthService,
    AuthResolver,
    AuthGuard,
    TokenBlacklistService,
    TokenService,
    JwtCacheService,
  ],
  exports: [
    AuthService,
    JwtModule,
    AuthGuard,
    TokenBlacklistService,
    TokenService,
    JwtCacheService,
  ],
})
export class AuthModule {}
