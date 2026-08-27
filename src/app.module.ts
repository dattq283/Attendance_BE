import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AttendanceRequestModule } from './attendance-request/attendance-request.module';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { NotificationModule } from './notification/notification.module';
import { ExportModule } from './export/export.module';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import deepLimit from 'graphql-depth-limit';
import {
  createComplexityRule,
  simpleEstimator,
} from 'graphql-query-complexity';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { Request, Response } from 'express';
import { GqlThrottlerGuard } from './auth/gql-throttle.guard';
import { CaslModule } from './casl/casl.module';
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
    }),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDevelopment =
          configService.get<string>('NODE_ENV') !== 'production';
        return {
          autoSchemaFile: true,
          sortSchema: true,
          playground: false,
          introspection: isDevelopment,
          context: ({ req, res }: { req: Request; res: Response }) => ({
            req,
            res,
          }),
          validationRules: isDevelopment
            ? []
            : [
                deepLimit(5),
                createComplexityRule({
                  maximumComplexity: 50,
                  estimators: [
                    simpleEstimator({
                      defaultComplexity: 1,
                    }),
                  ],
                }),
              ],

          plugins: isDevelopment
            ? [ApolloServerPluginLandingPageLocalDefault()]
            : [],
        };
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    PrismaModule,
    CaslModule,
    AuthModule,
    UserModule,
    AttendanceModule,
    AttendanceRequestModule,
    NotificationModule,
    ExportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
  ],
})
export class AppModule {}
