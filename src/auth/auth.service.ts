import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { CreateUserInput } from './dto/create-user.input';
import * as bcrypt from 'bcrypt';
import { LoginInput } from './dto/login.input';
import { ConfigService } from '@nestjs/config';
import { LoginRateLimiterService } from './login-rate-limit.service';
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private loginRateLimiter: LoginRateLimiterService,
  ) {}

  async login(input: LoginInput) {
    const allowed = await this.loginRateLimiter.checkLoginAttemps(input.email);
    if (!allowed) {
      throw new BadRequestException(
        'Too many login attempts. Please try again later.',
      );
    }
    const user = await this.prisma.client.user.findUnique({
      where: {
        email: input.email,
      },
    });
    if (!user || user.deletedAt)
      throw new UnauthorizedException('Invalid email or password!');

    // So sánh password
    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid email or password!');

    //Sinh token
    const accessToken = this.generateToken(user.id, user.email, user.role);
    return { accessToken, user };
  }
  private generateToken(userId: number, email: string, role: string) {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }

  async createUser(input: CreateUserInput) {
    const existedUser = await this.prisma.client.user.findUnique({
      where: {
        email: input.email,
      },
    });
    if (existedUser) {
      throw new ConflictException('User is existing!');
    }
    const salts = this.configService.get<number>('BCYPT_SALT_ROUNDS', 12);
    const hashedPassword = await bcrypt.hash(input.password, salts);
    return await this.prisma.client.user.create({
      data: {
        email: input.email,
        passwordHash: hashedPassword,
        fullName: input.fullName,
      },
    });
  }
}
