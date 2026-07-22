import { Injectable } from '@nestjs/common';
import { User, Attendance, AttendanceRequest } from '@prisma/client';
import { Ability, AbilityBuilder, ExtractSubjectType } from '@casl/ability';
import { Subjects, createPrismaAbility, PrismaQuery } from '@casl/prisma';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
export type AppSubjects =
  | 'all'
  | Subjects<{
      User: User;
      Attendance: Attendance;
      AttendanceRequest: AttendanceRequest;
    }>;
export type AppAbility = Ability<[Actions, AppSubjects], PrismaQuery>;
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: { userId: number; role: string }) {
    const { can, build } = new AbilityBuilder<AppAbility>(createPrismaAbility);
    if (user.role === 'ADMIN') {
      can('manage', 'all');
    } else {
      can('create', 'all');
      can('read', 'Attendance', { userId: user.userId });
      can('create', 'AttendanceRequest');
    }
    return build({
      detectSubjectType: (object) =>
        object.constructor as unknown as ExtractSubjectType<AppSubjects>,
    });
  }
}
