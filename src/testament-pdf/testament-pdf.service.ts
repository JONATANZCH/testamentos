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

  async requestPdfProcess(userId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();

    try {
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'No se pudo obtener instancia de Prisma.';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const newProcess = await this.pdfProcessRepository.createPdfProcess({
        userId,
        version: null,
        status: 'PdfQueued',
        htmlData: null,
        metadata: {},
      });

      const processId = newProcess.id;
      console.log(`Proceso de PDF creado con ID: ${processId}`);

      await this.enqueuePdfProcess(processId, userId);
      console.log(`Encolado en SQS el proceso con ID: ${processId}`);

      response.code = 200;
      response.msg =
        'Your PDF generation request has been successfully received and is being processed.';
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
      // 1) Obtener instancia de Prisma
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'No se pudo obtener instancia de Prisma.';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // 2) Buscar el proceso en la DB
      const processRecord =
        await this.pdfProcessRepository.getPdfProcessById(pdfProcessId);
      if (!processRecord) {
        response.code = 404;
        response.msg = 'No se encontró el proceso con ID ' + pdfProcessId;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      // 3) Actualizar estatus a GeneratingHtml
      await this.pdfProcessRepository.updateStatus(
        pdfProcessId,
        'GeneratingHtml',
      );

      // 4) Consultar datos del usuario
      const user = await this.prisma.user.findUnique({
        where: { id: processRecord.userId },
        include: {
          // Puedes incluir otras relaciones si lo necesitas, por ejemplo, testamentHeaders, addresses, etc.
        },
      });
      if (!user) {
        response.code = 404;
        response.msg = `Usuario con id ${processRecord.userId} no encontrado`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      // Opcional: consulta de datos adicionales (por ejemplo, del testamento)
      // const testament = await this.prisma.testamentHeader.findFirst({ where: { userId: user.id } });

      // 5) Armar objeto con los datos para reemplazo
      const data = {
        user_name: user.name || '',
        user_email: user.email || '',
        user_full_name:
          `${user.name} ${user.fatherLastName ?? ''} ${user.motherLastName ?? ''}`.trim(),
        user_birthDate: user.birthDate
          ? user.birthDate.toISOString().split('T')[0]
          : '',
        version: processRecord.version ? processRecord.version.toString() : '',
        process_id: pdfProcessId,
        // Otros datos que puedas necesitar para otras secciones:
        folio_number: processRecord.metadata?.folio_number || '',
        document_number: processRecord.metadata?.document_number || '',
        date_and_time_SIGNATURE:
          processRecord.metadata?.signature_datetime || '',
        // Ejemplo para sección de albacea:
        albacea_name: processRecord.metadata?.albacea_name || '',
        albacea_fatherLastName:
          processRecord.metadata?.albacea_fatherLastName || '',
        albacea_motherLastName:
          processRecord.metadata?.albacea_motherLastName || '',
        albacea_substitute_name:
          processRecord.metadata?.albacea_substitute_name || '',
        albacea_subtitue_fatherLastName:
          processRecord.metadata?.albacea_substitute_fatherLastName || '',
        albacea_subtitue_motherLastName:
          processRecord.metadata?.albacea_substitute_motherLastName || '',
        // Puedes seguir agregando campos para cada sección...
      };

      // 6) Leer la plantilla HTML base
      const templatePath = path.join(
        __dirname,
        'templates',
        'CleanTestamentoHTMLTable.html',
      );
      let htmlBase = await fs.readFile(templatePath, 'utf8');

      // 7) Realizar los reemplazos de placeholders
      htmlBase = htmlBase.replace(/#\{\{user_name\}\}#/g, data.user_name);
      htmlBase = htmlBase.replace(/#\{\{user_email\}\}#/g, data.user_email);
      htmlBase = htmlBase.replace(
        /#\{\{user_full_name\}\}#/g,
        data.user_full_name,
      );
      htmlBase = htmlBase.replace(
        /#\{\{user_birthDate\}\}#/g,
        data.user_birthDate,
      );
      htmlBase = htmlBase.replace(/#\{\{version\}\}#/g, data.version);
      htmlBase = htmlBase.replace(/#\{\{process_id\}\}#/g, data.process_id);
      htmlBase = htmlBase.replace(/#\{\{folio_number\}\}#/g, data.folio_number);
      htmlBase = htmlBase.replace(
        /#\{\{document_number\}\}#/g,
        data.document_number,
      );
      htmlBase = htmlBase.replace(
        /#\{\{date_and_time_SIGNATURE\}\}#/g,
        data.date_and_time_SIGNATURE,
      );
      htmlBase = htmlBase.replace(/#\{\{albacea_name\}\}#/g, data.albacea_name);
      htmlBase = htmlBase.replace(
        /#\{\{albacea_fatherLastName\}\}#/g,
        data.albacea_fatherLastName,
      );
      htmlBase = htmlBase.replace(
        /#\{\{albacea_motherLastName\}\}#/g,
        data.albacea_motherLastName,
      );
      htmlBase = htmlBase.replace(
        /#\{\{albacea_subtitue_name\}\}#/g,
        data.albacea_substitute_name,
      );
      htmlBase = htmlBase.replace(
        /#\{\{albacea_subtitue_fatherLastName\}\}#/g,
        data.albacea_subtitue_fatherLastName,
      );
      htmlBase = htmlBase.replace(
        /#\{\{albacea_subtitue_motherLastName\}\}#/g,
        data.albacea_subtitue_motherLastName,
      );
      // Realiza aquí los reemplazos para los demás placeholders de cada sección...

      if (!data.document_number) {
        htmlBase = htmlBase.replace(
          /<section id="section1">[\s\S]*?<\/section>/g,
          '',
        );
      }
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

      // 11) Encolar la generación de PDF en SQS
      const queueUrl = process.env.QUEUE_GENERATE_PDF;
      const payload = {
        html: {
          bucket: bucketName,
          key: htmlKey,
        },
        pdf: {
          bucket: bucketName,
          key: pdfProcessId + '.pdf',
        },
      };
      await this.sqsService.sendMessage(queueUrl, payload);

      // 12) Responder
      response.code = 200;
      response.msg =
        'HTML generado correctamente y encolado para conversión PDF.';
      response.response = { pdfProcessId };
      return response;
    } catch (error) {
      // En caso de error, marcar el proceso como Failed
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
