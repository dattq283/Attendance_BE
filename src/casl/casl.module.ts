import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { PoliciesGuard } from './policy.guard';
@Global()
@Module({
  imports: [CaslAbilityFactory],
  exports: [CaslAbilityFactory, PoliciesGuard],
})
export class CaslModule {}
