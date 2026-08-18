import { ExportService } from './export.service';
import { Args, Mutation, Resolver } from '@nestjs/graphql';

@Resolver()
export class ExportResolver {
  constructor(private readonly exportService: ExportService) {}
  @Mutation(() => String)
  async trgMonthlyExport(
    @Args('month') month: number,
    @Args('year') year: number,
  ): Promise<string> {
    return this.exportService.trgMonthlyExport(month, year);
  }
}
