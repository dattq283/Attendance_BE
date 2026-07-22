import { AttendanceType } from '@prisma/client';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
registerEnumType(AttendanceType, {
  name: 'AttendanceType',
});
@ObjectType()
export class Attendance {
  @Field(() => ID)
  id!: number;

  @Field(() => ID)
  userId!: number;

  @Field(() => Date)
  checkTime!: Date;

  @Field(() => AttendanceType)
  type!: AttendanceType;

  @Field(() => Date)
  createdAt!: Date;
}
