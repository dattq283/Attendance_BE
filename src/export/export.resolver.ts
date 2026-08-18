import { UseGuards } from '@nestjs/common';
import { ExportService } from './export.service';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { PoliciesGuard } from '../casl/policy.guard';
import { CheckPolicies } from '../casl/check-policy.decorator';

@Resolver()
export class ExportResolver {
  constructor(private readonly exportService: ExportService) {}
  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Mutation(() => String)
  @CheckPolicies((ability) => ability.can('create', 'AttendanceReport'))
  async trgMonthlyExport(
    @Args('month') month: number,
    @Args('year') year: number,
  ): Promise<string> {
    return this.exportService.trgMonthlyExport(month, year);
  }
}
