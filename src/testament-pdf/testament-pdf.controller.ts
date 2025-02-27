import {
  Controller,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
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

  @Post('/:userId/testaments/pdf')
  async requestPdfGeneration(
    @Param('userId') userId: string,
    @Body() body: { version: number },
  ): Promise<GeneralResponseDto> {
    if (!body.version) {
      const resp = new GeneralResponseDto();
      resp.code = 400;
      resp.msg = 'Debe especificar la versión del testamento en el body.';
      throw new HttpException(resp, HttpStatus.BAD_REQUEST);
    }

    return this.testamentPdfService.requestPdfProcess(userId, body.version);
  }

  @Post('/:userId/testaments/processpdf')
  async processPdfCallback(
    @Body() body: { pdfProcessId: string },
  ): Promise<GeneralResponseDto> {
    const resp = new GeneralResponseDto();
    if (!body.pdfProcessId) {
      resp.code = 400;
      resp.msg = 'Se requiere el id del proceso para continuar.';
      throw new HttpException(resp, HttpStatus.BAD_REQUEST);
    }

    return this.testamentPdfService.handlePdfProcess(body.pdfProcessId);
  }
}
