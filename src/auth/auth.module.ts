import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { PrismaModule } from '../../prisma/prisma.module';
import { LoginRateLimiterService } from './login-rate-limit.service';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
    PrismaModule,
  ],
  providers: [
    AuthService,
    AuthResolver,
    JwtStrategy,
    CaslAbilityFactory,
    LoginRateLimiterService,
  ],
  exports: [JwtModule],
})
export class AuthModule {}
