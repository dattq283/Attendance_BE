import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterInput } from './dto/register.input';
import * as bcrypt from 'bcrypt';
import { LoginInput } from './dto/login.input';
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}
  async register(input: RegisterInput) {
    const existingUser = await this.prisma.client.user.findUnique({
      where: {
        email: input.email,
      },
    });
    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng!');
    }
    //Hash password
    const hashedPassword = bcrypt.hashSync(input.password, 8);
    //Tạo user
    const user = await this.prisma.client.user.create({
      data: {
        email: input.email,
        passwordHash: hashedPassword,
        fullName: input.fullName,
      },
    });
    //Tạo accessToken
    const accessToken = this.generateToken(user.id, user.email, user.role);

    return { accessToken, user };
  }

  private generateToken(userId: number, email: string, role: string) {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }

  async login(input: LoginInput) {
    const user = await this.prisma.client.user.findUnique({
      where: {
        email: input.email,
      },
    });
    if (!user)
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng!');

    // So sánh password
    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng!');

    //Sinh token
    const accessToken = this.generateToken(user.id, user.email, user.role);
    return { accessToken, user };
  }
}
