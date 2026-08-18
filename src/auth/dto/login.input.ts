import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty } from 'class-validator';

@InputType()
export class LoginInput {
  @Field()
  @IsEmail({}, { message: 'Invalid email!' })
  email!: string;

  @Field()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;
}
