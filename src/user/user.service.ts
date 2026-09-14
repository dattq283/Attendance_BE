import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async softDeleteUser(userId: number, currentUserId: number) {
    if (userId === currentUserId) {
      throw new ForbiddenException('You cannot delete your own account!');
    }
    const target = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });
    if (!target || target.deletedAt) {
      throw new NotFoundException('User not found!');
    }
    if (target.role === 'ADMIN') {
      const activeAdmins = await this.prisma.client.user.count({
        where: { role: 'ADMIN', deletedAt: null },
      });
      if (activeAdmins <= 1) {
        throw new BadRequestException('Cannot delete the last admin!');
      }
    }
    return this.prisma.client.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }

  async reactiveUser(userId: number) {
    return this.prisma.client.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });
  }
}
