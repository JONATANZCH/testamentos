import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { PrismaProvider } from './providers/prisma-provider/prisma-provider';
import { ConfigService } from './config';
import { AssetsModule } from './assets-management/assets.module';
import { AddressesModule } from './addresses/addresses.module';
import { ContactsModule } from './contacts/contacts.module';
import { PetsModule } from './pets/pets.module';
import { LegalEntitiesModule } from './legal-entities/legal-entities.module';
import { TestamentsModule } from './testaments/testaments.module';
import { ExecutorModule } from './executor/executor.module';
import { SuscriptionsModule } from './suscriptions/suscriptions.module';
import { TestamentPdfModule } from './testament-pdf/testament-pdf.module';
import { LegaciesModule } from './legacies/legacies.module';
import { SendMessagesModule } from './send-messages/send-messages.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UsersModule,
    AssetsModule,
    AddressesModule,
    ContactsModule,
    PetsModule,
    LegalEntitiesModule,
    TestamentsModule,
    ExecutorModule,
    SuscriptionsModule,
    TestamentPdfModule,
    LegaciesModule,
    SendMessagesModule,
    ProductsModule,
  ],
  providers: [ConfigService, PrismaProvider],
  exports: [ConfigService],
})
export class AppModule {}
