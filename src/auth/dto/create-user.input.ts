import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

@InputType()
export class CreateUserInput {
  @Field()
  @IsEmail({}, { message: 'Invalid email!' })
  email!: string;

  @Field()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;

  @Field()
  @IsNotEmpty()
  fullName!: string;
}
