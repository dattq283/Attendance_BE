import { NotificationGateway } from './../notification/notification.gateway';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { AttendanceRequestInput } from './attendance-request.input';
import { RequestStatus } from '@prisma/client';
import { accessibleBy } from '@casl/prisma';
import { AttendanceRequest } from './attendance-request.entity';
@Injectable()
export class AttendanceRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly notificationGateway: NotificationGateway,
  ) {}
  async createRequest(userId: number, input: AttendanceRequestInput) {
    const { startTime, endTime, reason } = input;
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }
    if (startTime.toDateString() !== endTime.toDateString()) {
      throw new BadRequestException('Request must be for the same day');
    }
    const now = new Date();
    if (startTime > now) {
      throw new BadRequestException('Only create request in the past times');
    }

    return this.prisma.client.attendanceRequest.create({
      data: {
        userId,
        startTime,
        endTime,
        reason,
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
  async approveRequest(requestId: number, user: { userId: number }) {
    const result = await this.prisma.client.$transaction(async (tx) => {
      const updateResult = await tx.attendanceRequest.updateMany({
        where: {
          id: requestId,
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED',
          reviewBy: user.userId,
          reviewAt: new Date(),
        },
      });
      if (updateResult.count === 0) {
        throw new BadRequestException('Request is processing or not found!');
      }
      const request = await tx.attendanceRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
      await tx.attendance.createMany({
        data: [
          {
            userId: request.userId,
            checkTime: request.startTime,
            type: 'MANUAL',
            attendanceRequestId: request.id,
          },
          {
            userId: request.userId,
            checkTime: request.endTime,
            type: 'MANUAL',
            attendanceRequestId: request.id,
          },
        ],
      });
      return request;
    });
    this.notificationGateway.notifyUser(result.userId, 'requestApproved', {
      requestId: result.id,
      status: 'APPROVED',
      message: 'Your request is approved!',
    });
    return result;
  }

  async rejectRequest(
    requestId: number,
    user: { userId: number },
    note?: string,
  ): Promise<AttendanceRequest> {
    const updateResult = await this.prisma.client.attendanceRequest.updateMany({
      where: {
        id: requestId,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        reviewBy: user.userId,
        reviewAt: new Date(),
        note,
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestException('Request is processing or not found!');
    }

    const result = await this.prisma.client.attendanceRequest.findUniqueOrThrow(
      {
        where: { id: requestId },
      },
    );

    this.notificationGateway.notifyUser(result.userId, 'requestRejected', {
      requestId: result.id,
      status: 'REJECTED',
      message: `Your request is rejected!`,
    });

    return result;
  }
}
