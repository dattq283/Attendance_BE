import { ObjectType, Field } from '@nestjs/graphql';
import { User } from '../user/user.entity';
@ObjectType()
export class AuthResponse {
  @Field()
  accessToken!: string;

  @Field(() => User)
  user!: User;
}
