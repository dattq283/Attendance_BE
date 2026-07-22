import { ObjectType, Field, registerEnumType, ID } from '@nestjs/graphql';
import { Role } from '@prisma/client';

registerEnumType(Role, {
  name: 'Role',
});

@ObjectType()
export class User {
  @Field(() => ID)
  id!: number;

  @Field()
  fullName!: string;

  @Field()
  role!: Role;

  @Field()
  email!: string;

  @Field()
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  updatedAt?: Date | null;
}
