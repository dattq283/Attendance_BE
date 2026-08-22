import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, Max, Min } from 'class-validator';

@InputType()
export class ExportMonthlyInput {
  @Field(() => Int)
  @IsInt({ message: 'Month must be an integer' })
  @Min(1, { message: 'Month must be at least 1' })
  @Max(12, { message: 'Month must be at most 12' })
  month!: number;

  @Field(() => Int)
  @IsInt({ message: 'Year must be an integer' })
  @Min(1, { message: 'Year must be a positive integer' })
  year!: number;
}
