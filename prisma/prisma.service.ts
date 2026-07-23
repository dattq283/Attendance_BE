import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createCaslExtension } from '@casl/prisma';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client = new PrismaClient().$extends(createCaslExtension());

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
