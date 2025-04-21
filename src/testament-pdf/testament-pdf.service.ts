import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PdfProcessRepository } from './rempository/pdf-process.repository';
import { GeneralResponseDto } from '../common/response.dto';
import { PrismaProvider } from '../providers';
import { processException } from '../common/utils/exception.helper';
import { ConfigService } from '../config';
import { SqsService } from '../config/sqs-validate.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { HtmlGeneratorService } from './htmlGenerator.service';

@Injectable()
export class TestamentPdfService {
  private prisma: any = null;
  private readonly getQueueWillsCommunications: any;
  private readonly environment: string;
  private readonly sqsService: SqsService;
  private readonly s3Client: S3Client;

  constructor(
    private readonly pdfProcessRepository: PdfProcessRepository,
    private readonly prismaprovider: PrismaProvider,
    private readonly configService: ConfigService,
    readonly sqsservice: SqsService,
    private readonly htmlGeneratorService: HtmlGeneratorService,
  ) {
    this.environment = this.configService.getNodeEnv();
    this.getQueueWillsCommunications =
      this.configService.getQueueWillsCommunications();
    this.sqsService = sqsservice;
    this.s3Client = new S3Client({});
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
        response.msg = 'Failed to get Prisma instance.';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const existUser = await this.prisma.user.findFirst({
        where: {
          id: userId,
        },
      });
      if (!existUser) {
        response.code = 404;
        response.msg = `User with ID ${userId} not found.`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const existsVersion = await this.pdfProcessRepository.validateVersion(
        userId,
        version,
      );
      if (!existsVersion) {
        response.code = 400;
        response.msg = `Version ${version} does not exist for user ${userId}.`;
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      // Validar que el testamento esté en estado 'DRAFT'
      const testament = await this.prisma.testamentHeader.findFirst({
        where: {
          userId,
          version,
          status: 'DRAFT',
        },
      });

      if (!testament) {
        response.code = 400;
        response.msg =
          'Only testaments in DRAFT status can request PDF generation.';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const newProcess = await this.pdfProcessRepository.createPdfProcess({
        userId,
        version,
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
    console.log(
      `[handlePdfProcess] Starting with pdfProcessId=${pdfProcessId}`,
    );

    try {
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (!this.prisma) {
        console.log(`[handlePdfProcess] Prisma is null`);
        response.code = 500;
        response.msg = 'Failed to get Prisma instance.';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const processRecord =
        await this.pdfProcessRepository.getPdfProcessById(pdfProcessId);
      if (!processRecord) {
        response.code = 404;
        response.msg = `Process with ID not found ${pdfProcessId}`;
        console.log(
          `[handlePdfProcess] pdfProcess not found -> ${pdfProcessId}`,
        );
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      console.log(`[handlePdfProcess] pdfProcessRecord=`, processRecord);

      await this.pdfProcessRepository.updateStatus(
        pdfProcessId,
        'GeneratingHtml',
      );

      const testamentHeader = await this.prisma.testamentHeader.findFirst({
        where: {
          userId: processRecord.userId,
          version: processRecord.version,
        },
        include: {
          user: {
            include: {
              addresses: true,
              pets: true,
              termsAndOffers: true,
              assets: {
                include: {
                  category: true,
                },
              },
              contacts: {
                include: {
                  legalEntity: true,
                },
              },
            },
          },
          Executor: {
            include: {
              contact: true,
            },
          },
          TestamentAssignment: {
            include: {
              asset: {
                include: {
                  category: true,
                },
              },
            },
          },
          universalHeir: true,
          Legacy: {
            include: {
              contact: {
                include: { legalEntity: true },
              },
            },
          },
        },
      });

      if (!testamentHeader) {
        response.code = 404;
        response.msg = `User whit id: ${processRecord.userId} not found`;
        console.log(
          `[handlePdfProcess] user not found -> userId=${processRecord.userId}`,
        );
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      console.log(`[handlePdfProcess] user =>`, testamentHeader);

      const htmlBase =
        await this.htmlGeneratorService.generateHtml(testamentHeader);

      console.log(
        `[handlePdfProcess] Final HTML after replacements (first 500 chars):\n`,
        htmlBase.slice(0, 500),
      );

      // 10) Guardar en DB
      await this.pdfProcessRepository.updateHtmlData(pdfProcessId, htmlBase);
      console.log(
        `[handlePdfProcess] HTML stored in DB (pdfProcess.htmlData).`,
      );

      // 11) Cambiar estatus a HtmlOk
      await this.pdfProcessRepository.updateStatus(pdfProcessId, 'HtmlOk');

      // 12) Subir a S3
      const bucketName = process.env.BUCKET_WILL;
      const { htmlKey, pdfKey } = this.generateS3Keys(
        processRecord.userId,
        processRecord.version,
      );
      const s3Client = this.s3Client;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: htmlKey,
          Body: htmlBase,
          ContentType: 'text/html',
        }),
      );
      console.log(`[handlePdfProcess] File HTML uploaded to S3: ${htmlKey}`);

      // 13) Enviar a SQS
      const queueUrl = process.env.QUEUE_GENERATE_PDF;
      console.log(`[handlePdfProcess] Enqueuing message to SQS =>`, queueUrl);
      const payload = {
        html: { bucket: bucketName, key: htmlKey },
        pdf: { bucket: bucketName, key: pdfKey },
        proccesId: pdfProcessId,
      };
      await this.sqsService.sendMessage(queueUrl, payload);
      console.log(`[handlePdfProcess] Sent message to SQS =>`, payload);

      response.code = 200;
      response.msg = 'Sección 1 generada y encolada para conversión PDF.';
      response.response = { pdfProcessId };
      console.log('[handlePdfProcess] Response =>', response);
      return response;
    } catch (error) {
      console.error(`[handlePdfProcess] Unexpected error =>`, error);
      await this.pdfProcessRepository
        .updateStatus(pdfProcessId, 'Failed')
        .catch(() => null);
      processException(error);
    }
  }

  private async enqueuePdfProcess(
    processId: string,
    userId: string,
  ): Promise<void> {
    const pathReq = `/${this.environment}/wills/${userId}/processpdf`;

    const sqsBody = {
      version: '2.0',
      rawPath: pathReq,
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
          path: pathReq,
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

    const queueUrl = this.getQueueWillsCommunications;
    console.log(
      '[enqueuePdfProcess] Enqueuing message to SQS =>',
      sqsBody,
      queueUrl,
    );
    try {
      await this.sqsService.sendMessage(queueUrl, sqsBody);
    } catch (error) {
      console.error(
        `[enqueuePdfProcess] Error sending message to SQS =>`,
        error,
      );
      throw new HttpException(
        'Error sending message to SQS',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    console.log(
      `[enqueuePdfProcess] SQS message enqueued for pdfProcessId=${processId}`,
    );
  }

  async getProcessStatus(
    processId: string,
    body: any,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();

    try {
      console.log(
        `[getProcessStatus] Starting with processId=${processId} body=`,
        body,
      );
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (!this.prisma) {
        response.code = 500;
        response.msg = 'Failed to get Prisma instance.';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const processRecord =
        await this.pdfProcessRepository.getPdfProcessById(processId);
      if (!processRecord) {
        response.code = 404;
        response.msg = `Process with ID not found ${processId}`;
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      if (body.status) {
        console.log(
          `[getProcessStatus] Updating pdfProcess ID=${processId} with status=${body.status}...`,
        );

        const pdfUrl = `s3://${body.pdf.bucket}/${body.pdf.key}`;

        await this.pdfProcessRepository.updatePdfProcess({
          id: processId,
          status: body.status === 'success' ? 'PdfOk' : 'Failed',
          metadata: {
            pdfUrl: pdfUrl,
          },
        });
        console.log(
          `[getProcessStatus] pdfProcess updated with status and pdfUrl=${pdfUrl}`,
        );

        const header = await this.prisma.testamentHeader.findFirst({
          where: {
            userId: processRecord.userId,
            version: processRecord.version,
          },
        });

        if (!header) {
          console.log(
            `[getProcessStatus] testamentHeader not found => userId=${processRecord.userId}, version=${processRecord.version}`,
          );
          response.code = 404;
          response.msg = `TestamentHeader not found for userId=${processRecord.userId}, version=${processRecord.version}`;
          throw new HttpException(response, HttpStatus.NOT_FOUND);
        }

        await this.prisma.testamentHeader.update({
          where: { id: header.id },
          data: {
            pdfStatus: body.status,
            url: {
              set: {
                bucket: body.pdf.bucket,
                key: body.pdf.key,
                proccesId: body.proccesId,
              },
            },
          },
        });

        console.log(
          `[getProcessStatus] testamentHeader updated => userId=${processRecord.userId}, version=${processRecord.version}`,
        );
      }

      console.log(
        `[getProcessStatus] Response => processId=${processId}, status=${processRecord.status}`,
      );
      response.code = 200;
      response.msg = 'Process status retrieved successfully.';
      response.response = {
        processId,
        status: processRecord.status,
      };
      return response;
    } catch (error) {
      console.error(`[getProcessStatus] Unexpected error =>`, error);
      processException(error);
    }
  }

  private generateS3Keys(userId: string, version: number) {
    return {
      htmlKey: `${userId}_${version}.html`,
      pdfKey: `${userId}_${version}.pdf`,
    };
  }
}
