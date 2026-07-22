import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterInput } from './dto/register.input';
import * as bcrypt from 'bcrypt';
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}
  async register(input: RegisterInput) {
    const existingUser = await this.prisma.user.findUnique({
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
    const user = await this.prisma.user.create({
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
}
