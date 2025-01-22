import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaProvider } from '../providers';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '../config';

@Module({
  imports: [ConfigModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaProvider, ConfigService],
})
export class UsersModule {}
