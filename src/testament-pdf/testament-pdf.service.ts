import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PdfProcessRepository } from './rempository/pdf-process.repository';
import { GeneralResponseDto } from '../common/response.dto';
import { PrismaProvider } from '../providers';
import { processException } from '../common/utils/exception.helper';
import { ConfigService } from '../config';
import { SqsService } from '../config/sqs-validate.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class TestamentPdfService {
  private prisma: any = null;
  private readonly getQueueProcessPdf: any;
  private readonly environment: string;
  private readonly sqsService: SqsService;

  constructor(
    private readonly pdfProcessRepository: PdfProcessRepository,
    private readonly prismaprovider: PrismaProvider,
    private readonly configService: ConfigService,
    readonly sqsservice: SqsService,
  ) {
    this.environment = this.configService.getNodeEnv();
    this.sqsService = sqsservice;
  }

  async requestPdfProcess(
    userId: string,
    version: number,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();

    try {
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'No se pudo obtener instancia de Prisma.';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // 1) Insert en la tabla pdfProcess
      const newProcess = await this.pdfProcessRepository.createPdfProcess({
        userId,
        version,
        status: 'Pending',
        htmlData: null,
        metadata: {},
      });

      // 2) Envía mensaje a SQS con el `id` (opcional: agrega un body JSON)
      const processId = newProcess.id;
      console.log(`Proceso de PDF creado con ID: ${processId}`);

      // 3) Encolar el proceso
      await this.enqueuePdfProcess(processId, userId);
      console.log(`Encolado en SQS el proceso con ID: ${processId}`);

      // Armamos la respuesta
      response.code = 200;
      response.msg =
        'Solicitud de generación PDF registrada y encolada en SQS.';
      response.response = {
        pdfProcessId: processId,
      };
      return response;
    } catch (error) {
      processException(error);
    }
  }

  async handlePdfProcess(pdfProcessId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'No se pudo obtener instancia de Prisma.';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // 1) Buscar proceso
      const processRecord =
        await this.pdfProcessRepository.getPdfProcessById(pdfProcessId);
      if (!processRecord) {
        response.code = 404;
        response.msg = 'No se encontró el proceso con ID ' + pdfProcessId;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      // 2) Cambiar estatus a GeneratingHtml
      await this.pdfProcessRepository.updateStatus(
        pdfProcessId,
        'GeneratingHtml',
      );

      // 3) Obtener datos del usuario (y/o testamento, etc.) para el reemplazo
      const user = await this.prisma.user.findUnique({
        where: { id: processRecord.userId },
      });
      if (!user) {
        response.code = 404;
        response.msg = `Usuario con id ${processRecord.userId} no encontrado`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      // (Aquí podrías obtener datos del testamento, join con otras tablas, etc.)
      // Ejemplo: const testament = await this.prisma.testamentHeader.findFirst({ ... });

      // 4) Leer plantilla HTML base
      const templatePath = path.join(
        __dirname,
        'templates',
        'base-testament.html',
      );
      let htmlBase = await fs.readFile(templatePath, 'utf8');

      // 5) Reemplazar placeholders
      htmlBase = htmlBase.replace(/#\{\{user_name\}\}#/g, user.name);
      htmlBase = htmlBase.replace(/#\{\{user_email\}\}#/g, user.email);
      htmlBase = htmlBase.replace(
        /#\{\{user_full_name\}\}#/g,
        `${user.name} ${user.fatherLastName ?? ''} ${user.motherLastName ?? ''}`,
      );
      htmlBase = htmlBase.replace(
        /#\{\{user_birthDate\}\}#/g,
        user.birthDate?.toISOString().split('T')[0] ?? '',
      );
      htmlBase = htmlBase.replace(
        /#\{\{version\}\}#/g,
        processRecord.version.toString(),
      );
      htmlBase = htmlBase.replace(/#\{\{process_id\}\}#/g, pdfProcessId);

      await this.pdfProcessRepository.updateHtmlData(pdfProcessId, htmlBase);

      await this.pdfProcessRepository.updateStatus(pdfProcessId, 'HtmlOk');

      const bucketName = process.env.BUCKET_WILL;
      const htmlKey = pdfProcessId + '.html';
      const s3Client = new S3Client({});

      const s3Params = {
        Bucket: bucketName,
        Key: htmlKey,
        Body: htmlBase,
        ContentType: 'text/html',
      };
      await s3Client.send(new PutObjectCommand(s3Params));
      console.log('File HTML uploaded successfully to S3:', htmlKey);

      const queProcessPdf = process.env.QUEUE_GENERATE_PDF;
      const payload = {
        html: {
          bucket: process.env.BUCKET_WILL,
          key: pdfProcessId + '.html',
        },
        pdf: {
          bucket: process.env.BUCKET_WILL,
          key: pdfProcessId + '.pdf',
        },
      };
      await this.sqsService.sendMessage(queProcessPdf, payload);

      response.code = 200;
      response.msg =
        'HTML generado correctamente y encolado para conversión PDF.';
      response.response = { pdfProcessId };
      return response;
    } catch (error) {
      // Si hay error, marcamos como Failed
      await this.pdfProcessRepository
        .updateStatus(pdfProcessId, 'Failed')
        .catch(() => null);
      processException(error);
    }
  }

  private async enqueuePdfProcess(processId: any, userId: any): Promise<void> {
    const path =
      `/${this.environment}/wills/users/` + userId + `/testaments/processpdf`;
    const sqsBody = {
      version: '2.0',
      rawPath: path,
      rawQueryString: '',
      headers: {
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'content-type': 'application/json',
        host: '51lyy4n8z0.execute-api.us-east-2.amazonaws.com',
        'user-agent': 'NestJS/testament-pdf',
        'x-amzn-trace-id': 'Root=1-66568d30-7b6681ce265207223508242e',
        'x-forwarded-for': '',
        'x-forwarded-port': '443',
        'x-forwarded-proto': 'https',
      },
      requestContext: {
        http: {
          method: 'POST',
          path: path,
          protocol: 'HTTP/1.1',
          sourceIp: '',
          userAgent: 'NestJS/testament-pdf',
        },
      },
      pathParameters: {
        proxy: '163',
      },
      isBase64Encoded: false,
      body: JSON.stringify({ pdfProcessId: processId }),
    };

    console.log(`[enqueuePdfProcess] SQS message: ${JSON.stringify(sqsBody)}`);
    const queueUrl = process.env.QUEUE_PROCESS_PDF;
    await this.sqsService.sendMessage(queueUrl, sqsBody);
    console.log(
      `[enqueuePdfProcess] Message enqueued for pdfProcessId=${processId}`,
    );
  }
}
