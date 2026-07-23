import { CaslAbilityFactory } from './../casl/casl-ability.factory';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { accessibleBy } from '@casl/prisma';
@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}
  async checkIn(userId: number) {
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
