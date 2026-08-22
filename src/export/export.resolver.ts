import { UseGuards } from '@nestjs/common';
import { ExportService } from './export.service';
import { Query, Args, Mutation, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { PoliciesGuard } from '../casl/policy.guard';
import { CheckPolicies } from '../casl/check-policy.decorator';
import { ExportMonthlyInput } from './export-monthly.input';
import { CurrentUser } from '../auth/current-user.decorator';
import { ExportJob } from './export-job.entity';

@Resolver()
export class ExportResolver {
  constructor(private readonly exportService: ExportService) {}
  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Mutation(() => String)
  @CheckPolicies((ability) => ability.can('create', 'AttendanceReport'))
  async trgMonthlyExport(
    @CurrentUser('userId') userId: number,
    @Args('input') input: ExportMonthlyInput,
  ): Promise<string> {
    return this.exportService.trgMonthlyExport(input.month, input.year, userId);
  }
  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Query(() => ExportJob, { nullable: true })
  @CheckPolicies((ability) => ability.can('read', 'AttendanceReport'))
  async getExportReport(@Args('exportId') exportId: string) {
    return this.exportService.getExportReport(exportId);
  }
}
