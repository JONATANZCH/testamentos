import { Module } from '@nestjs/common';
import { SendMessagesService } from './send-messages.service';
import { SendMessagesController } from './send-messages.controller';
import { ConfigService } from '../config';
import { PrismaProvider } from '../providers';

@Module({
  controllers: [SendMessagesController],
  providers: [SendMessagesService, ConfigService, PrismaProvider],
})
export class SendMessagesModule {}
