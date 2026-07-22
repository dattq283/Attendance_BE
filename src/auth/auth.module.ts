import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { JwtStrategy } from './jwt.strategy';

@Module({
  providers: [AuthService, AuthResolver, JwtStrategy],
})
export class AuthModule {}
