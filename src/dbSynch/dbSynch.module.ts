import { Module, forwardRef } from '@nestjs/common';
import { DatabaseSyncService } from './dbSynch.service';
import { DatabaseSyncController } from './dbSynch.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { DatabaseSyncResolver } from './dbSynch.resolver';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '43200s' },
      }),
    }),
    forwardRef(() => UserModule),
    forwardRef(() => AuthModule),
  ],
  providers: [DatabaseSyncService, DatabaseSyncResolver],
  controllers: [DatabaseSyncController],
  exports: [DatabaseSyncService],
})
export class DatabaseSyncModule {}
