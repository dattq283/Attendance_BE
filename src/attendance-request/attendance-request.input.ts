import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
@InputType()
export class AttendanceRequestInput {
  @Field(() => Date)
  @IsNotEmpty({ message: 'Thời gian không được để trống!' })
  startTime!: Date;

  @Field(() => Date)
  @IsNotEmpty({ message: 'Thời gian không được để trống!' })
  endTime!: Date;

  @Field()
  @IsNotEmpty({ message: 'Lý do không được để trống!' })
  reason!: string;
}
