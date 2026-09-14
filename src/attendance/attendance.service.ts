import { RedisService } from './../redis/redis.service';
import { CaslAbilityFactory } from './../casl/casl-ability.factory';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { accessibleBy } from '@casl/prisma';
import { dayStart, dayEnd } from '../utils/date.util';
import { randomUUID } from 'crypto';
@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private caslAbilityFactory: CaslAbilityFactory,
    private redisService: RedisService,
  ) {}
  async checkIn(userId: number) {
    const lockKey = `checkin_lock:${userId}`;
    const id = randomUUID();
    let lockAcquired = false;
    try {
      lockAcquired =
        (await this.redisService.client.set(lockKey, id, 'EX', 3, 'NX')) !==
        null;
      if (!lockAcquired) {
        throw new BadRequestException('Checkin is being processed!');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      console.log('Redis unavailable!');
      lockAcquired = false;
    }
    try {
      const now = new Date();
      const start = dayStart(now);
      const end = dayEnd(now);
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
    } finally {
      if (!lockAcquired) {
        try {
          if ((await this.redisService.client.get(lockKey)) === id) {
            await this.redisService.client.del(lockKey);
          }
        } catch {
          console.log('Faild to checkin!');
        }
      }
    }
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
