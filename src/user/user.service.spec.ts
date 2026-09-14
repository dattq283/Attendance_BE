/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UserService', () => {
  let service: UserService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      client: {
        user: {
          findUnique: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('softDeleteUser', () => {
    it('chặn khi xóa chính tài khoản của mình', async () => {
      await expect(service.softDeleteUser(1, 1)).rejects.toThrow(
        'You cannot delete your own account!',
      );
      expect(prisma.client.user.update).not.toHaveBeenCalled();
    });

    it('ném NotFoundException khi user không tồn tại', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      await expect(service.softDeleteUser(2, 1)).rejects.toThrow(
        'User not found!',
      );
      expect(prisma.client.user.update).not.toHaveBeenCalled();
    });

    it('ném NotFoundException khi user đã bị soft-delete', async () => {
      prisma.client.user.findUnique.mockResolvedValue({
        id: 2,
        role: 'EMPLOYEE',
        deletedAt: new Date(),
      });
      await expect(service.softDeleteUser(2, 1)).rejects.toThrow(
        'User not found!',
      );
    });

    it('chặn xóa admin cuối cùng (count = 1)', async () => {
      prisma.client.user.findUnique.mockResolvedValue({
        id: 2,
        role: 'ADMIN',
        deletedAt: null,
      });
      prisma.client.user.count.mockResolvedValue(1);
      await expect(service.softDeleteUser(2, 1)).rejects.toThrow(
        'Cannot delete the last admin!',
      );
      expect(prisma.client.user.update).not.toHaveBeenCalled();
    });

    it('cho phép xóa admin khi count > 1', async () => {
      prisma.client.user.findUnique.mockResolvedValue({
        id: 2,
        role: 'ADMIN',
        deletedAt: null,
      });
      prisma.client.user.count.mockResolvedValue(2);
      prisma.client.user.update.mockResolvedValue({
        id: 2,
        deletedAt: new Date(),
      });

      await service.softDeleteUser(2, 1);

      expect(prisma.client.user.count).toHaveBeenCalledWith({
        where: { role: 'ADMIN', deletedAt: null },
      });
      expect(prisma.client.user.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('xóa EMPLOYEE mà không cần đếm admin', async () => {
      prisma.client.user.findUnique.mockResolvedValue({
        id: 2,
        role: 'EMPLOYEE',
        deletedAt: null,
      });
      prisma.client.user.update.mockResolvedValue({
        id: 2,
        deletedAt: new Date(),
      });

      await service.softDeleteUser(2, 1);

      expect(prisma.client.user.count).not.toHaveBeenCalled();
      expect(prisma.client.user.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('reactiveUser', () => {
    it('set deletedAt về null', async () => {
      prisma.client.user.update.mockResolvedValue({ id: 1, deletedAt: null });

      await service.reactiveUser(1);

      expect(prisma.client.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: null },
      });
    });
  });
});
