import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { TestamentPdfService } from './testament-pdf.service';
import { GeneralResponseDto } from '../common/response.dto';
import { ConfigService } from '../config/config.service';

@Controller('wills/users')
export class TestamentPdfController {
  private readonly environment: string;

  constructor(
    private readonly testamentPdfService: TestamentPdfService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills/users';
    Reflect.defineMetadata('path', this.environment, TestamentPdfController);
    console.log('Version - 20250123 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Get('/:userId/testaments/pdf')
  async requestPdfGeneration(
    @Param('userId') userId: string,
  ): Promise<GeneralResponseDto> {
    return this.testamentPdfService.requestPdfProcess(userId);
  }

  @Post('/:userId/testaments/processpdf')
  async processPdfCallback(
    @Body() body: { pdfProcessId: string },
  ): Promise<GeneralResponseDto> {
    return this.testamentPdfService.handlePdfProcess(body.pdfProcessId);
  }
}
