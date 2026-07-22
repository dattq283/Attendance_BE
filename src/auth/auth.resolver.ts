import { AuthResponse } from './auth-response.entity';
import { AuthService } from './auth.service';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { RegisterInput } from './dto/register.input';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => AuthResponse)
  register(@Args('input') input: RegisterInput): Promise<AuthResponse> {
    return this.authService.register(input);
  }
}
