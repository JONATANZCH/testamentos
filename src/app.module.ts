import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { PrismaProvider } from './providers/prisma-provider/prisma-provider';
import { ConfigService } from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UsersModule,
  ],
  providers: [ConfigService, PrismaProvider],
  exports: [ConfigService],
})
export class AppModule {}
