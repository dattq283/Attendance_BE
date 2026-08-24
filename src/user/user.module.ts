import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResolver } from './user.resolver';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UserService, UserResolver, CaslAbilityFactory],
})
export class UserModule {}
