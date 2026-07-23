import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { RequestStatus } from '@prisma/client';

registerEnumType(RequestStatus, {
  name: 'RequestStatus',
});

@ObjectType()
export class AttendanceRequest {
  @Field(() => ID)
  id!: number;

  @Field(() => ID)
  userId!: number;

  @Field(() => Date)
  requestTime!: Date;

  @Field(() => String)
  reason!: string;

  @Field(() => RequestStatus)
  status!: RequestStatus;

  @Field(() => ID, { nullable: true })
  reviewBy?: number | null;

  @Field(() => Date, { nullable: true })
  reviewAt?: Date | null;

  @Field(() => String, { nullable: true })
  note?: string | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date | null;

  @Field(() => ID, { nullable: true })
  attendanceId?: number | null;
}
