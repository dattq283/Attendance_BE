import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { ExportStatus } from '@prisma/client';

registerEnumType(ExportStatus, {
  name: 'ExportStatus',
});

@ObjectType()
export class ExportJob {
  @Field(() => ID)
  id!: number;

  @Field(() => String)
  exportId!: string;

  @Field(() => Int)
  exportMonth!: number;

  @Field(() => Int)
  exportYear!: number;

  @Field(() => ID, { nullable: true })
  exportedBy?: number | null;

  @Field(() => ExportStatus)
  status!: ExportStatus;

  @Field(() => String, { nullable: true })
  path?: string | null;

  @Field(() => Date, { nullable: true })
  completedTime?: Date | null;

  @Field(() => String, { nullable: true })
  reason?: string | null;
}
