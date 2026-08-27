import { CaslAbilityFactory } from './../casl/casl-ability.factory';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { accessibleBy } from '@casl/prisma';
@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}
  async checkIn(userId: number) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const countTimes = await this.prisma.client.attendance.count({
      where: { userId, checkTime: { gte: start, lte: end } },
    });
    if (countTimes >= 4) {
      throw new BadRequestException('Checkin over times!');
    }
    const lastCheckIn = await this.prisma.client.attendance.findFirst({
      where: {
        userId,
      },
      orderBy: { checkTime: 'desc' },
    });
    if (
      lastCheckIn &&
      now.getTime() - lastCheckIn.checkTime.getTime() < 5 * 60000
    ) {
      throw new BadRequestException(
        'Must wait at least 5 minutes for next checkin!',
      );
    }
    return this.prisma.client.attendance.create({
      data: {
        userId: userId,
        checkTime: new Date(),
      },
    });
  }

  async showHistory(
    user: { userId: number; role: string },
    from?: Date,
    to?: Date,
  ) {
    const ability = this.caslAbilityFactory.createForUser(user);
    return this.prisma.client.attendance.findMany({
      where: {
        AND: [
          accessibleBy(ability).ofType('Attendance'),
          ...(from || to
            ? [
                {
                  checkTime: {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lte: to } : {}),
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: {
        checkTime: 'desc',
      },
    });
  }
}
