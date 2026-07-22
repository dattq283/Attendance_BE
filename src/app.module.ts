import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AttendanceRequestModule } from './attendance-request/attendance-request.module';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { AppResolver } from './app.resolver';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.sql',
      sortSchema: true,
      playground: true,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    AttendanceModule,
    AttendanceRequestModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, AppResolver, CaslAbilityFactory],
})
export class AppModule {}
