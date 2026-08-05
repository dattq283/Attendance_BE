import { NotificationGateway } from './../notification/notification.gateway';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { AttendanceRequestInput } from './attendance-request.input';
import { RequestStatus } from '@prisma/client';
import { accessibleBy } from '@casl/prisma';
@Injectable()
export class AttendanceRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly notificationGateway: NotificationGateway,
  ) {}
  async createRequest(userId: number, input: AttendanceRequestInput) {
    const now = new Date();
    if (input.startTime >= now || input.endTime >= now) {
      throw new BadRequestException(
        'Chỉ tạo được đơn xin chấm công ở thời điểm trong quá khứ!',
      );
    }
    if (input.startTime >= input.endTime) {
      throw new BadRequestException(
        'Thời gian bắt đầu phải trước thời gian kết thúc',
      );
    }
    return this.prisma.client.attendanceRequest.create({
      data: {
        userId,
        startTime: input.startTime,
        endTime: input.endTime,
        reason: input.reason,
      },
    });
  }
  async showRequestList(
    user: { userId: number; role: string },
    status?: RequestStatus,
  ) {
    const ability = this.caslAbilityFactory.createForUser(user);

    return this.prisma.client.attendanceRequest.findMany({
      where: {
        AND: [
          accessibleBy(ability).ofType('AttendanceRequest'),
          ...(status ? [{ status }] : []),
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
  async approveRequest(
    requestId: number,
    user: { userId: number; role: string },
  ) {
    const result = await this.prisma.client.$transaction(async (tx) => {
      const request = await tx.attendanceRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new BadRequestException('Không tìm thấy đơn');
      }

      if (request.status !== 'PENDING') {
        throw new BadRequestException('Đơn đã được xử lý');
      }

      await tx.attendance.create({
        data: {
          userId: request.userId,
          checkTime: request.startTime,
          type: 'MANUAL',
          attendanceRequestId: request.id,
        },
      });

      await tx.attendance.create({
        data: {
          userId: request.userId,
          checkTime: request.endTime,
          type: 'MANUAL',
          attendanceRequestId: request.id,
        },
      });

      return tx.attendanceRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewBy: user.userId,
          reviewAt: new Date(),
        },
      });
    });

    this.notificationGateway.notifyUser(result.userId, 'requestApproved', {
      requestId: result.id,
      status: 'APPROVED',
    });

    return result;
  }

  async rejectRequest(
    requestId: number,
    user: { userId: number; role: string },
    note?: string,
  ) {
    const result = await this.prisma.client.$transaction(async (tx) => {
      const request = await tx.attendanceRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new BadRequestException('Không tìm thấy đơn');
      }

      if (request.status !== 'PENDING') {
        throw new BadRequestException('Đơn đã được xử lý');
      }

      return tx.attendanceRequest.update({
        where: {
          id: requestId,
        },
        data: {
          status: 'REJECTED',
          reviewBy: user.userId,
          reviewAt: new Date(),
          note,
        },
      });
    });

    this.notificationGateway.notifyUser(result.userId, 'requestRejected', {
      requestId: result.id,
      status: 'REJECTED',
    });

    return result;
  }
}
