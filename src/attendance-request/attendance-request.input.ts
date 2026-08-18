import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
@InputType()
export class AttendanceRequestInput {
  @Field(() => Date)
  @IsNotEmpty({ message: 'Start time is required!' })
  startTime!: Date;

  @Field(() => Date)
  @IsNotEmpty({ message: 'End time is required!' })
  endTime!: Date;

  @Field()
  @IsNotEmpty({ message: 'Reason is required!' })
  reason!: string;
}
