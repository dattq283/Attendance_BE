import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { AttendanceRequestInput } from './attendance-request.input';

@Injectable()
export class AttendanceRequestService {
  constructor(
    private prisma: PrismaService,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}
  async createRequest(userId: number, input: AttendanceRequestInput) {
    if (input.requestTime >= new Date()) {
      throw new BadRequestException(
        'Chỉ tạo được đơn xin chấm công ở thời điểm trong quá khứ!',
      );
    }
    return this.prisma.client.attendanceRequest.create({
      data: {
        userId,
        requestTime: input.requestTime,
        reason: input.reason,
      },
    });
  }
}
