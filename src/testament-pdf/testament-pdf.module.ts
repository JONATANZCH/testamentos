import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TestamentPdfService } from './testament-pdf.service';
import { TestamentPdfController } from './testament-pdf.controller';
import { PrismaProvider } from '../providers';
import { ConfigService } from '../config';
import { PdfProcessRepository } from './rempository/pdf-process.repository';
import { SqsService } from '../config/sqs-validate.service';
import { HtmlGeneratorService } from './htmlGenerator.service';
import { SqsModule } from '../config/sqs.module';

@Module({
  imports: [HttpModule, SqsModule],
  controllers: [TestamentPdfController],
  providers: [
    TestamentPdfService,
    PrismaProvider,
    ConfigService,
    PdfProcessRepository,
    SqsService,
    HtmlGeneratorService,
  ],
  exports: [HtmlGeneratorService],
})
export class TestamentPdfModule {}
