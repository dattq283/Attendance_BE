import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty } from 'class-validator';

@InputType()
export class LoginInput {
  @Field()
  @IsEmail({}, { message: 'Email không hợp lệ!' })
  email!: string;

  @Field()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password!: string;
}
