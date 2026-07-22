import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail({}, { message: 'Email không hợp lệ!' })
  email!: string;

  @Field()
  @MinLength(6, { message: 'Mật khẩu ít nhất 6 ký tự' })
  password!: string;

  @Field()
  @IsNotEmpty()
  fullName!: string;
}
