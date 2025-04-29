import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaProvider } from '../providers';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '../config';
import { SqsModule } from '../config/sqs.module';

@Module({
  imports: [ConfigModule, SqsModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaProvider, ConfigService],
})
export class UsersModule {}
