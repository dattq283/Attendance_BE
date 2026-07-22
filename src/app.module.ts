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
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.sql',
      sortSchema: true,
      playground: true,
    }),
    AuthModule,
    UserModule,
    AttendanceModule,
    AttendanceRequestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
