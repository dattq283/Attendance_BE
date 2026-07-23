import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}
  async checkIn(userId: number) {
    return this.prisma.client.attendance.create({
      data: {
        userId: userId,
        checkTime: new Date(),
      },
    });
  }
}
