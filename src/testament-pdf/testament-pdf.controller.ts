import { Controller, Post, Body, Param } from '@nestjs/common';
import { TestamentPdfService } from './testament-pdf.service';
import { GeneralResponseDto } from '../common/response.dto';
import { ConfigService } from '../config/config.service';

@Controller('wills')
export class TestamentPdfController {
  private readonly environment: string;

  constructor(
    private readonly testamentPdfService: TestamentPdfService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills';
    Reflect.defineMetadata('path', this.environment, TestamentPdfController);
    console.log('Version - 20250123 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Post('/:userId/pdf')
  async requestPdfGeneration(
    @Param('userId') userId: string,
    @Body('version') version: number,
  ): Promise<GeneralResponseDto> {
    console.log(`[requestPdfGeneration] userId=${userId}, version=${version}`);
    return this.testamentPdfService.requestPdfProcess(userId, version);
  }

  @Post('/:userId/processpdf')
  async processPdfCallback(
    @Body() body: { pdfProcessId: string },
  ): Promise<GeneralResponseDto> {
    console.log(`[processPdfCallback] pdfProcessId=${body.pdfProcessId}`);
    return this.testamentPdfService.handlePdfProcess(body.pdfProcessId);
  }

  @Post('/status/pdfGenerate/:processId')
  async getProcessStatus(
    @Param('processId') processId: string,
    @Body() body: any,
  ) {
    console.log(`[getProcessStatus] processId=${processId}`);
    return this.testamentPdfService.getProcessStatus(processId, body);
  }
}
