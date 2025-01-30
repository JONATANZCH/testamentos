import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { PrismaProvider } from '../providers';
import { ConfigService } from '../config';

@Module({
  controllers: [ContactsController],
  providers: [ContactsService, PrismaProvider, ConfigService],
})
export class ContactsModule {}
