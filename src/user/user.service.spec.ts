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
        user: { update: jest.fn() },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('softDeleteUser', () => {
    it('nên set deletedAt thành thời điểm hiện tại', async () => {
      prisma.client.user.update.mockResolvedValue({
        id: 1,
        deletedAt: new Date(),
      });

      await service.softDeleteUser(1);

      expect(prisma.client.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('reactiveUser', () => {
    it('nên set deletedAt về null', async () => {
      prisma.client.user.update.mockResolvedValue({ id: 1, deletedAt: null });

      await service.reactiveUser(1);

      expect(prisma.client.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: null },
      });
    });
  });
});
