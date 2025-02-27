import { Module } from '@nestjs/common';
import { TestamentPdfService } from './testament-pdf.service';
import { TestamentPdfController } from './testament-pdf.controller';
import { PrismaProvider } from '../providers';
import { ConfigService } from '../config';
import { PdfProcessRepository } from './rempository/pdf-process.repository';
import { SqsService } from '../config/sqs-validate.service';

@Module({
  controllers: [TestamentPdfController],
  providers: [
    TestamentPdfService,
    PrismaProvider,
    ConfigService,
    PdfProcessRepository,
    SqsService,
  ],
})
export class TestamentPdfModule {}
