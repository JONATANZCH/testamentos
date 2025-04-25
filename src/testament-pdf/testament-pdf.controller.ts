import { Controller, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { TestamentPdfService } from './testament-pdf.service';
import { GeneralResponseDto } from '../common/response.dto';
import { ConfigService } from '../config/config.service';
import { ValidateSeguridataProcessIdDto } from './dto/seguirdata.dto';

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
  ): Promise<GeneralResponseDto> {
    console.log(`[getProcessStatus] processId=${processId}`);
    return this.testamentPdfService.getProcessStatus(processId, body);
  }

  @Post('/:testamentId/sign')
  async signTestament(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    console.log(`[signTestament] testamentId=${testamentId}`);
    return this.testamentPdfService.signTestament(testamentId);
  }

  @Post('/:seguridataprocessId/processsigned')
  async processSigned(
    @Param() params: ValidateSeguridataProcessIdDto,
    @Body() body?: any,
  ): Promise<GeneralResponseDto> {
    const { seguridataprocessId } = params;
    console.log(
      '[TestamentController] Processing signed for seguridataprocessId:',
      seguridataprocessId,
    );
    return await this.testamentPdfService.processSignedContract(
      seguridataprocessId,
      body ?? {},
    );
  }
}
