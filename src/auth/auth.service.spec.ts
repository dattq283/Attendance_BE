/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginRateLimiterService } from './login-rate-limit.service';
import { CreateUserInput } from './dto/create-user.input';
import { LoginInput } from './dto/login.input';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    client: {
      user: {
        findUnique: jest.Mock;
        create: jest.Mock;
      };
    };
  };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };
  let loginRateLimiter: { checkLoginAttemps: jest.Mock };

  beforeEach(async () => {
    prisma = {
      client: {
        user: {
          findUnique: jest.fn(),
          create: jest.fn(),
        },
      },
    };
    jwtService = { sign: jest.fn().mockReturnValue('fake_token') };
    configService = {
      get: jest
        .fn()
        .mockImplementation((_key: string, defaultValue?: number) => {
          return defaultValue;
        }),
    };
    loginRateLimiter = {
      checkLoginAttemps: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        {
          provide: LoginRateLimiterService,
          useValue: loginRateLimiter,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const validUser = {
      id: 1,
      email: 'a@b.com',
      passwordHash: 'hashed_password_123',
      role: 'EMPLOYEE',
      deletedAt: null,
    };

    const loginInput: LoginInput = { email: 'a@b.com', password: '123456' };

    it('kiểm tra login rate limit bằng email trước khi xử lý', async () => {
      prisma.client.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login(loginInput);

      expect(loginRateLimiter.checkLoginAttemps).toHaveBeenCalledWith(
        loginInput.email,
      );
    });

    it('throw BadRequestException khi vượt quá số lần đăng nhập cho phép', async () => {
      loginRateLimiter.checkLoginAttemps.mockResolvedValue(false);

      await expect(service.login(loginInput)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.client.user.findUnique).not.toHaveBeenCalled();
    });

    it('throw UnauthorizedException nếu email không tồn tại', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throw UnauthorizedException nếu user đã bị soft-delete (deletedAt có giá trị)', async () => {
      prisma.client.user.findUnique.mockResolvedValue({
        ...validUser,
        deletedAt: new Date(),
      });

      await expect(service.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throw UnauthorizedException nếu password sai', async () => {
      prisma.client.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginInput.password,
        validUser.passwordHash,
      );
    });

    it('không sinh token và không trả user khi password sai', async () => {
      prisma.client.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginInput)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('trả về accessToken và user nếu đăng nhập đúng', async () => {
      prisma.client.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginInput);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginInput.password,
        validUser.passwordHash,
      );
      expect(result.accessToken).toBe('fake_token');
      expect(result.user).toEqual(validUser);
    });

    it('gọi jwtService.sign với payload {sub, email, role} chính xác', async () => {
      prisma.client.user.findUnique.mockResolvedValue(validUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await service.login(loginInput);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: validUser.id,
        email: validUser.email,
        role: validUser.role,
      });
    });
  });

  describe('createUser', () => {
    const createUserInput: CreateUserInput = {
      email: 'new@b.com',
      password: 'plain123',
      fullName: 'Test User',
    };

    it('throw ConflictException nếu email đã tồn tại', async () => {
      prisma.client.user.findUnique.mockResolvedValue({ id: 1 });

      await expect(service.createUser(createUserInput)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.client.user.create).not.toHaveBeenCalled();
    });

    it('đọc BCYPT_SALT_ROUNDS từ config, mặc định 12 nếu không có', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      prisma.client.user.create.mockResolvedValue({ id: 2 });

      await service.createUser(createUserInput);

      expect(configService.get).toHaveBeenCalledWith('BCYPT_SALT_ROUNDS', 12);
      // mock trả defaultValue (tức 12) khi không có env var đặt giá trị
      expect(bcrypt.hash).toHaveBeenCalledWith('plain123', 12);
    });

    it('hash password bằng salt rounds từ config trước khi lưu', async () => {
      configService.get.mockReturnValue(10);
      prisma.client.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_with_10');
      prisma.client.user.create.mockResolvedValue({ id: 2 });

      await service.createUser(createUserInput);

      expect(bcrypt.hash).toHaveBeenCalledWith('plain123', 10);
    });

    it('lưu passwordHash (đã hash), không lưu plain text', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password_value');
      prisma.client.user.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 2, ...data }),
      );

      await service.createUser(createUserInput);

      const createArgs = prisma.client.user.create.mock.calls[0][0];
      expect(createArgs.data.passwordHash).toBe('hashed_password_value');
      expect(createArgs.data.passwordHash).not.toBe(createUserInput.password);
      expect(createArgs.data.email).toBe(createUserInput.email);
      expect(createArgs.data.fullName).toBe(createUserInput.fullName);
    });

    it('tạo user và trả về bản ghi user đã tạo', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const created = { id: 2, email: 'new@b.com' };
      prisma.client.user.create.mockResolvedValue(created);

      const result = await service.createUser(createUserInput);

      expect(result).toEqual(created);
    });

    it('KHÔNG trả về accessToken (chỉ Admin tạo hộ, không phải tự đăng nhập)', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      prisma.client.user.create.mockResolvedValue({
        id: 2,
        email: 'new@b.com',
      });

      const result = await service.createUser(createUserInput);

      expect(result).not.toHaveProperty('accessToken');
    });
  });
});
