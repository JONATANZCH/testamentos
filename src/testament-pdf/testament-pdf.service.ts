import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PdfProcessRepository } from './rempository/pdf-process.repository';
import { GeneralResponseDto } from '../common/response.dto';
import { PrismaProvider } from '../providers';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { processException } from '../common/utils/exception.helper';
import { promises as fs } from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '../config';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { SqsService } from '../config/sqs-validate.service';
import { HtmlGeneratorService } from './htmlGenerator.service';
import { v4 as uuidv4 } from 'uuid';
import { HttpService } from '@nestjs/axios';
import { SharedOperationsService } from '../config/shared-operations.service';
import {
  CreateSignPdfDto,
  SignProcessType,
} from '../common/dto/create-sign-pdf.dto';

@Injectable()
export class TestamentPdfService {
  private prisma: any = null;
  private readonly getQueueWillsCommunications: any;
  private readonly environment: string;
  private readonly sqsService: SqsService;
  private readonly s3Client: S3Client;
  private readonly getBucketWill: string;
  private readonly signer_base_rest: string;
  private readonly signer_base: string;
  private readonly signer_authorization: string;
  private readonly signer_org_string: string;
  private readonly signer_t003c002: string;
  private readonly signer_t003c004: string;
  private readonly signer_idcat: string;
  private readonly signer_idsol: string;
  private readonly signer_org: string;
  private readonly signer_tipo: string;
  private readonly signer_perfil: string;
  private readonly signer_flujofirma: string;
  private readonly signer_hd: string;
  private env_var_error: boolean = false;
  private readonly getEmailFrom: any;
  private readonly getSgSendWills: any;
  private readonly getSqsCommNoWaitQueue: any;
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly pdfProcessRepository: PdfProcessRepository,
    private readonly prismaprovider: PrismaProvider,
    private readonly configService: ConfigService,
    private readonly nestConfigService: NestConfigService,
    private readonly sharedOperationsService: SharedOperationsService,
    readonly sqsservice: SqsService,
    private readonly htmlGeneratorService: HtmlGeneratorService,
    private readonly httpService: HttpService,
  ) {
    this.environment = this.configService.getNodeEnv();
    this.getQueueWillsCommunications =
      this.configService.getQueueWillsCommunications();
    this.sqsService = sqsservice;
    this.s3Client = new S3Client({ region: process.env.AWSREGION });
    this.getBucketWill = this.configService.getBucketWill();
    this.signer_base =
      this.nestConfigService.get<string>('signer_url_base') ?? '';
    this.signer_base_rest = (this.signer_base ?? '') + '/rest';
    this.signer_authorization =
      this.nestConfigService.get<string>('signer_authorization') ?? '';
    this.signer_org = this.nestConfigService.get<string>('signer_org') ?? '';
    this.signer_org_string =
      this.nestConfigService.get<string>('signer_org_string') ?? '';
    this.signer_t003c002 =
      this.nestConfigService.get<string>('signer_t003c002') ?? '';
    this.signer_t003c004 =
      this.nestConfigService.get<string>('signer_t003c004') ?? '';
    this.signer_idcat =
      this.nestConfigService.get<string>('signer_idcat') ?? '';
    this.signer_idsol =
      this.nestConfigService.get<string>('signer_idsol') ?? '';
    this.signer_tipo = this.nestConfigService.get<string>('signer_tipo') ?? '';
    this.signer_perfil =
      this.nestConfigService.get<string>('signer_perfil') ?? '';
    this.signer_flujofirma =
      this.nestConfigService.get<string>('signer_flujofirma') ?? '';
    this.signer_hd = this.nestConfigService.get<string>('signer_hd') ?? '';
    this.getEmailFrom = this.configService.getEmailFrom();
    this.getSgSendWills = this.configService.getSgSendWills();
    this.getSqsCommNoWaitQueue = this.configService.getSqsCommNoWaitQueue();
    this.sqsClient = new SQSClient({
      region: this.configService.getAwsRegion(),
    });

    if (
      !this.signer_base ||
      !this.signer_base_rest ||
      !this.signer_idcat ||
      !this.signer_tipo ||
      !this.signer_perfil ||
      !this.signer_org ||
      !this.signer_t003c002 ||
      !this.signer_t003c004 ||
      !this.signer_idsol ||
      !this.signer_authorization ||
      !this.signer_flujofirma ||
      !this.signer_hd
    ) {
      this.env_var_error = true;
      console.log('Env var error: Missing signer env variables');
    }
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
      console.log('testamentHeader', testamentHeader);

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
      const bucketName = this.getBucketWill;
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
      htmlKey: `${userId}/${userId}_${version}.html`,
      pdfKey: `${userId}/${userId}_${version}.pdf`,
    };
  }

  async signTestament(testamentId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    const sessionId = uuidv4();
    try {
      if (this.env_var_error) {
        console.log(
          'Error getting env variables we cannot sign a contract. Review that all env variables are set. sessionId ->' +
            sessionId,
        );
        response.code = 500;
        response.msg =
          'Error signing contract. Review ms config - SessionId-> ' + sessionId;
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      // validar que el contrato exista
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (this.prisma == null) {
        response.code = 500;
        response.msg = 'error code csnjl7';
        console.log('Pastpost Error-> 234sa2ga1');
        console.log(
          'Could not connect to DB, no prisma client created error getting secret',
        );
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const contract = await this.prisma.testamentHeader.findUniqueOrThrow({
        where: { id: testamentId },
        include: {
          user: true,
        },
      });
      if (!contract) {
        response.code = 404;
        response.msg = 'Contract not found';
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      console.log('Contract Found', contract);
      const userId = contract.userId;
      const resultvalidates3 = await this.sharedOperationsService.getFileFromS3(
        this.getBucketWill,
        userId + '/' + userId + '_' + userId + '.pdf',
      );
      if (resultvalidates3 === null) {
        response.code = 404;
        response.msg = 'Pdf not found, process document first';
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      console.log(
        'Starting signature process sessionId=' +
          sessionId +
          ' - document=-' +
          testamentId,
      );
      // validar que el contrato no este firmado
      console.log('got contract info');
      const metadata = contract.metadata ?? {};
      let seguridataprocessinfo: any = null;

      if (Array.isArray(metadata.signprocessinfo)) {
        seguridataprocessinfo = metadata.signprocessinfo;
      }
      if (contract.signatureStatus === 'Signed') {
        console.log('Contract already signed. sessionId ->' + sessionId);
        response.code = 400;
        response.msg = 'Contract already signed';
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '0',
          {},
          { error: 'Contract already signed' },
          'failed',
          { testamentId: contract.id },
        );
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }
      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '0',
        {},
        { message: 'starting signature process.', url: this.signer_base_rest },
        'ok',
        { testamentId: contract.id },
      );
      // firmar el contrato
      // devolver el contrato firmado
      //const base = "https://qa.resolve.com.mx:8443/resolve/rest"
      const url1 = this.signer_base_rest + '/log/in';
      const headers = {
        'Content-Type': 'application/json',
        Authorization: this.signer_authorization,
      };
      const body = {
        org: this.signer_org_string,
        t003c002: this.signer_t003c002,
        t003c004: this.signer_t003c004,
      };
      let result = await this.sharedOperationsService.makePostRequest(
        url1,
        body,
        headers,
        true,
      );
      if (
        result.code != 200 ||
        result.response !== 1 ||
        (typeof result.response == 'string' &&
          result.response.toLowerCase().includes('error'))
      ) {
        console.log('result ->' + result.response);
        console.log('error loging to seguridata. sessionId ->' + sessionId);
        response.code = 500;
        response.msg = 'Error signing contract- SessionId-> ' + sessionId;
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '1',
          body,
          result,
          'failed',
          { testamentId: contract.id },
        );
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '1',
        body,
        result,
        'ok',
        { testamentId: contract.id },
      );

      console.log('loggin success');
      //////////2 creating a new process////////////////////////
      let seguridataprocessid: string = null;
      if (!seguridataprocessinfo) {
        // verify if the contract already has a process id
        console.log('Creating new process');
        const body2 = {
          idcat: this.signer_idcat,
          idsol: this.signer_idsol,
        };
        const url2 = this.signer_base_rest + '/process/new';
        result = await this.sharedOperationsService.makePostRequest(
          url2,
          body2,
          headers,
          true,
        );
        console.log('result', result);
        if (
          result.code != 200 ||
          (typeof result.response == 'string' &&
            result.response.toLowerCase().includes('error'))
        ) {
          console.log('result ->' + result.response);
          console.log('error creating process. sessionId ->' + sessionId);
          response.code = 500;
          response.msg = 'Error signing contract- SessionId-> ' + sessionId;
          await this.sharedOperationsService.sendSignatureLog(
            sessionId,
            userId,
            new Date(),
            '2',
            body2,
            result,
            'failed',
            { testamentId: contract.id },
          );
          console.log('we responded with ' + JSON.stringify(response));
          throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        console.log('process created' + JSON.stringify(result));
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '2',
          body2,
          result,
          'ok',
          { testamentId: contract.id },
        );
        seguridataprocessid = result.response;
        const info = {
          date: new Date(),
          seguridataprocessid: seguridataprocessid,
        };
        metadata.signprocessinfo = [];
        metadata.signprocessinfo.push(info);
        const c = await this.prisma.testamentHeader.update({
          where: { id: testamentId },
          data: {
            metadata: metadata,
          },
        });
        if (c.metadata.signprocessinfo) {
          seguridataprocessinfo = c.metadata.signprocessinfo;
        }
      } else {
        seguridataprocessid = seguridataprocessinfo[0].seguridataprocessid;
        console.log(
          'contract already had a processid, steps to create NEW process discarded. pid ' +
            seguridataprocessid,
        );
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '2',
          seguridataprocessid,
          {
            info: 'contract alredy had a processid, steps to create NEW process discarded',
          },
          'ok',
          { testamentId: contract.id },
        );
      }
      //////////3 adding the file////////////////////////
      if (!seguridataprocessinfo || !seguridataprocessinfo[0].fileadded) {
        const url3 = this.signer_base_rest + '/process/addfiletoprc';
        console.log('Adding file to process');
        const formData = [
          {
            key: 'idprc',
            value: seguridataprocessid,
          },
          {
            key: 'idcto',
            value: this.signer_idsol,
          },
          {
            key: 'idorg',
            value: this.signer_org,
          },
        ];

        result = await this.sharedOperationsService.postFileAsFormData(
          url3,
          this.getBucketWill,
          userId + '/' + userId + '_' + contract.version + '.pdf',
          headers,
          formData,
        );
        if (
          result.code != 200 ||
          (typeof result.response == 'string' &&
            result.response.toLowerCase().includes('error'))
        ) {
          console.log('result ->' + result.response);
          console.log('error adding file to process. sessionId ->' + sessionId);
          response.code = 500;
          response.msg = 'Error signing contract - SessionId-> ' + sessionId;
          await this.sharedOperationsService.sendSignatureLog(
            sessionId,
            userId,
            new Date(),
            '3',
            formData,
            result,
            'failed',
            { testamentId: contract.id },
          );
          console.log('we responded with ' + JSON.stringify(response));
          throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        metadata.signprocessinfo[0].fileadded = true;
        seguridataprocessinfo[0].fileadded = true;
        await this.prisma.testamentHeader.update({
          where: { id: testamentId },
          data: {
            metadata: metadata,
          },
        });
        console.log('file added to process');
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '3',
          formData,
          result,
          'ok',
          { testamentId: contract.id },
        );
      } else {
        console.log('file already added to process we will not add it again');
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '3',
          {},
          'file already added to process',
          'ok',
          { testamentId: contract.id },
        );
      }
      //////////4//////////////////////// AGREGAR TITULO DE EXPENDIENTE
      if (!seguridataprocessinfo || !seguridataprocessinfo[0].title) {
        console.log('setting title');
        const url4 = this.signer_base_rest + '/process/update';
        const body4 = {
          idprc: parseInt(seguridataprocessid, 10),
          fld: 'p8',
          data: contract.id + '.pdf',
          tipo: 0,
        };
        result = await this.sharedOperationsService.makePostRequest(
          url4,
          body4,
          headers,
          true,
        );
        if (
          result.code != 200 ||
          (typeof result.response == 'string' &&
            result.response.toLowerCase().includes('error'))
        ) {
          console.log('result ->' + result.response);
          console.log('error setting title. sessionId ->' + sessionId);
          response.code = 500;
          response.msg = 'Error signing contract - SessionId-> ' + sessionId;
          result = await this.sharedOperationsService.sendSignatureLog(
            sessionId,
            userId,
            new Date(),
            '4',
            body4,
            result,
            'failed',
            { testamentId: contract.id },
          );
          console.log('we responded with ' + JSON.stringify(response));
          throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        metadata.signprocessinfo[0].title = true;
        seguridataprocessinfo[0].title = true;
        await this.prisma.testamentHeader.update({
          where: { id: testamentId },
          data: {
            metadata: metadata,
          },
        });
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '4',
          body4,
          result,
          'ok',
          { testamentId: contract.id },
        );
      } else {
        console.log('title already added to process we will not add it again');
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '4',
          {},
          'title already added to process',
          'ok',
          { testamentId: contract.id },
        );
      }
      //////////5//////////////////////// AGREGAR NUMERO FIRMANTES
      if (!seguridataprocessinfo || !seguridataprocessinfo[0].firmantes) {
        console.log('setting firmantes');
        const url5 = this.signer_base_rest + '/process/update';
        const body5 = {
          idprc: parseInt(seguridataprocessid, 10),
          fld: 'p33',
          data: 1, //<- numero de firmantes
          tipo: 0,
        };
        result = await this.sharedOperationsService.makePostRequest(
          url5,
          body5,
          headers,
          true,
        );
        if (
          result.code != 200 ||
          (typeof result.response == 'string' &&
            result.response.toLowerCase().includes('error'))
        ) {
          console.log('result ->' + result.response);
          console.log('error setting firmantes. sessionId ->' + sessionId);
          response.code = 500;
          response.msg = 'error setting firmantes 5 - SessionId-> ' + sessionId;
          await this.sharedOperationsService.sendSignatureLog(
            sessionId,
            userId,
            new Date(),
            '5',
            body5,
            result,
            'failed',
            { testamentId: contract.id },
          );
          console.log('we responded with ' + JSON.stringify(response));
          throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        metadata.signprocessinfo[0].firmantes = true;
        await this.prisma.testamentHeader.update({
          where: { id: testamentId },
          data: {
            metadata: metadata,
          },
        });
        seguridataprocessinfo[0].firmantes = true;
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '5',
          body5,
          result,
          'ok',
          { testamentId: contract.id },
        );
      } else {
        console.log(
          'firmantes already added to process we will not add it again',
        );
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '5',
          {},
          'firmantes already added to process',
          'ok',
          { testamentId: contract.id },
        );
      }
      //////////6//////////////////////// getting token
      console.log('getting token');
      const url6 = this.signer_base_rest + '/process/addtkzphtrltr';
      const body6 = {
        idprc: parseInt(seguridataprocessid, 10),
        nombre: [
          contract.user.name,
          contract.user.fatherLastName,
          contract.user.motherLastName,
        ]
          .filter(Boolean)
          .join(' '),
        email: contract.user.email,
        tipo: String(this.signer_tipo),
        perfil: String(this.signer_perfil),
        org: String(this.signer_org),
        firma: String(this.signer_flujofirma),
      };
      result = await this.sharedOperationsService.makePostRequest(
        url6,
        body6,
        headers,
        true,
      );
      console.log('result token', result);
      if (typeof result.response === 'string') {
        console.log('token recibido:', result.response);
      }
      if (
        result.code != 200 ||
        (typeof result.response == 'string' &&
          result.response.toLowerCase().includes('error'))
      ) {
        console.log(result.response);
        console.log('error getting token. sessionId ->' + sessionId);
        response.code = 500;
        response.msg = 'error getting token 6 - SessionId-> ' + sessionId;
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '6',
          body6,
          result,
          'failed',
          { testamentId: contract.id },
        );
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      response.code = 200;
      response.msg = 'success - SessionId-> ' + sessionId; //1358
      const urlcalculated =
        this.signer_base +
        '/Extr.hd?task=access&hd=' +
        this.signer_hd +
        '&idorg=' +
        this.signer_org +
        '&org=' +
        this.signer_org +
        '&idprc=' +
        seguridataprocessid +
        '&token=' +
        result.response +
        '&idp=6177';
      response.response = { url: urlcalculated };
      result.urlcalculated = urlcalculated;
      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '6',
        body6,
        result,
        'ok',
        { testamentId: contract.id },
      );
      console.log('url generada' + JSON.stringify(response));
      return response;
    } catch (error) {
      if (error.name === 'HttpException') {
        throw error;
      }
      if (error.name === 'NotFoundError') {
        response.code = 404;
        response.msg = 'Not Found';
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      console.log('unexpected error ', error);
      console.log('Pastpost Error-> as22asd&dK');
      response.code = 500;
      response.msg = 'error code as22asd&dK';
      console.log('we responded with ' + JSON.stringify(response));
      throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async processSignedContract(seguridataprocessIdParam: number, body: any) {
    const response = new GeneralResponseDto();
    console.log(`[Webhook/${seguridataprocessIdParam}] Body received:`, body);
    let currentSignatureProcess: any = null;
    try {
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (this.prisma == null) {
        response.code = 500;
        response.msg = 'error code 234sa2ga1';
        console.log('Wills Error-> 234sa2ga1');
        console.log(
          'Could not connect to DB, no prisma client created error getting secret',
        );
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      currentSignatureProcess = await this.prisma.signatureProcess.findUnique({
        where: { seguridataprocessid: seguridataprocessIdParam },
        include: { user: true },
      });

      console.log(
        `[Webhook/${seguridataprocessIdParam}] Seguridata ID from param:`,
        seguridataprocessIdParam,
      );
      console.log(
        `[Webhook/${seguridataprocessIdParam}] Matches (SignatureProcess found):`,
        currentSignatureProcess ? currentSignatureProcess.id : 'None',
      );

      if (!currentSignatureProcess) {
        response.code = 404;
        response.msg = 'Seguridata process ID not found in our records';
        console.log(
          `[Webhook/${seguridataprocessIdParam}] Wills Error-> csvd15y - No SignatureProcess found`,
        );
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      const userId = currentSignatureProcess.userId;
      const internalSignatureProcessId = currentSignatureProcess.id;

      if (!userId || !currentSignatureProcess.user) {
        console.log(
          `[Webhook/${seguridataprocessIdParam}] User info missing in SP_ID ${internalSignatureProcessId}`,
        );
        throw new HttpException(
          'User information missing for signature process',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      console.log(
        `[Webhook/${seguridataprocessIdParam}] Internal SignatureProcess ID:`,
        internalSignatureProcessId,
      );

      const signatureRecord = await this.prisma.$queryRaw<any[]>`
          SELECT *
          FROM SignatureStatus
          WHERE step = '6'
            AND signatureProcessId = ${internalSignatureProcessId}
            AND JSON_UNQUOTE(JSON_EXTRACT(sendMetadata, '$.idprc')) = ${seguridataprocessIdParam}
          ORDER BY date DESC
          LIMIT 1
      `;

      if (!signatureRecord) {
        console.log(
          `[${internalSignatureProcessId}] Session ID not found in SignatureStatus for Seguridata ID ${seguridataprocessIdParam}`,
        );
        throw new HttpException(
          'Original session ID for process not found',
          HttpStatus.NOT_FOUND,
        );
      }
      const sessionId = signatureRecord[0].signSession;
      console.log(
        `[${sessionId}] Session ID retrieved from SignatureStatus: ${sessionId}`,
      );

      let happadMetadata = signatureRecord[0].sendMetadata;
      if (typeof happadMetadata === 'string') {
        try {
          happadMetadata = JSON.parse(happadMetadata);
        } catch (err) {
          console.log(`[${sessionId}] Invalid JSON in sendMetadata:`, err);
          throw new HttpException(
            'Invalid sendMetadata format',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const requiredFields = [
        'org',
        'tipo',
        'email',
        'firma',
        'nombre',
        'perfil',
      ];
      const missing = requiredFields.filter((key) => !(key in happadMetadata));
      if (missing.length > 0) {
        console.log(
          `[${sessionId}] [Happad Check] Some expected fields are missing in logged sendMetadata: ${missing.join(', ')}`,
        );
      } else {
        console.log(
          `[${sessionId}] [Happad Check] All expected fields are present in logged sendMetadata.`,
        );
      }
      console.log(
        `[${sessionId}] Happad (sendMetadata from token step log):`,
        happadMetadata,
      );

      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '100',
        { originalWebhookBody: body },
        { note: 'Webhook received from Seguridata' },
        'ok',
        { signatureProcessId: internalSignatureProcessId },
      );

      console.log(
        `[${sessionId}] Webhook body content for SP_ID ${internalSignatureProcessId}:`,
        body,
      );
      let parsedBodyForLog: any = {};
      let stepStatusForLog = 'failed';
      try {
        if (body && Object.keys(body).length > 0) {
          parsedBodyForLog = typeof body === 'string' ? JSON.parse(body) : body;
          const isValid =
            typeof parsedBodyForLog === 'object' &&
            parsedBodyForLog.code === 200 &&
            parsedBodyForLog.msg &&
            parsedBodyForLog.response &&
            typeof parsedBodyForLog.response.publish === 'object' &&
            typeof parsedBodyForLog.response.publish.data === 'string';
          stepStatusForLog = isValid ? 'ok' : 'failed_body_validation';
          if (!isValid)
            console.log(
              `[${sessionId}] [Body Validation] Body does not meet expected structure for SP_ID ${internalSignatureProcessId}:`,
              parsedBodyForLog,
            );
        } else {
          console.log(
            `[${sessionId}] [Body Check] No body received in request for SP_ID ${internalSignatureProcessId}.`,
          );
          stepStatusForLog = 'no_body_received_ok';
        }
      } catch (error) {
        console.log(
          `[${sessionId}] [Webhook Body Block Error] for SP_ID ${internalSignatureProcessId}:`,
          error,
        );
        stepStatusForLog = 'body_parse_error';
        parsedBodyForLog = { error: error.message, originalBody: body };
      }
      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '101',
        parsedBodyForLog,
        { note: 'Webhook body processed', validation: stepStatusForLog },
        stepStatusForLog.startsWith('failed') ? 'failed' : 'ok',
        { signatureProcessId: internalSignatureProcessId },
      );

      const originalRequestDto = currentSignatureProcess.metadata
        ?.originalRequest as CreateSignPdfDto;
      if (!originalRequestDto?.processtosign?.length) {
        console.log(
          `[${sessionId}] No 'originalRequest.processtosign' in metadata for SP_ID ${internalSignatureProcessId}.`,
        );
        throw new HttpException(
          'Original document list metadata missing',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      for (const docItem of originalRequestDto.processtosign) {
        if (docItem.type === SignProcessType.WILL) {
          await this.prisma.testamentHeader.update({
            where: { id: docItem.id },
            data: { signatureStatus: 'Signed' },
          });
          console.log(
            `[${sessionId}] Testament ${docItem.id} status updated to Signed.`,
          );
        } else if (docItem.type === SignProcessType.INSURANCE) {
          await this.prisma.userPartnerProductContract.update({
            where: { id: docItem.id },
            data: { signatureStatus: 'Signed' },
          });
          console.log(
            `[${sessionId}] Contract ${docItem.id} status updated to Signed.`,
          );
        }
      }
      await this.prisma.signatureProcess.update({
        where: { id: internalSignatureProcessId },
        data: { status: 'signed_confirmed_by_webhook' },
      });

      console.log(
        `[${sessionId}] Initiating download for SP_ID ${internalSignatureProcessId}, Seguridata ID ${seguridataprocessIdParam}.`,
      );
      const downloadResult =
        await this.sharedOperationsService.downloadSeguridataContract(
          currentSignatureProcess,
          originalRequestDto.processtosign,
          sessionId,
          seguridataprocessIdParam,
        );

      if (downloadResult.code !== 200) {
        console.log(
          `[${sessionId}] Error downloading docs for SP_ID ${internalSignatureProcessId}: ${JSON.stringify(downloadResult)}`,
        );
        throw new HttpException(
          downloadResult.msg ||
            'Failed to download signed documents from provider',
          downloadResult.code || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      console.log(
        `[${sessionId}] Signed docs downloaded and stored in S3 for SP_ID ${internalSignatureProcessId}.`,
      );
      for (const docItem of originalRequestDto.processtosign) {
        if (docItem.type === SignProcessType.WILL) {
          await this.prisma.testamentHeader.update({
            where: { id: docItem.id },
            data: { signatureStatus: 'SignedPdfDownloaded' },
          });
        } else if (docItem.type === SignProcessType.INSURANCE) {
          await this.prisma.userPartnerProductContract.update({
            where: { id: docItem.id },
            data: { signatureStatus: 'SignedPdfDownloaded' },
          });
        }
      }
      await this.prisma.signatureProcess.update({
        where: { id: internalSignatureProcessId },
        data: { status: 'signed_documents_stored' },
      });
      console.log(
        `[${sessionId}] Preparing email for SP_ID ${internalSignatureProcessId}.`,
      );
      // const mailResponse = await this.sendMailWithAttachments(
      //   currentSignatureProcess,
      //   originalRequestDto.processtosign,
      //   sessionId,
      // );
      // console.log(
      //   `[${sessionId}] RES sendMailWithAttachments for SP_ID ${internalSignatureProcessId}: `,
      //   mailResponse,
      // );

      // if (mailResponse.code === 200) {
      //   await this.prisma.signatureProcess.update({
      //     where: { id: internalSignatureProcessId },
      //     data: { status: 'signed_documents_emailed' },
      //   });
      // } else {
      //   console.log(
      //     `[${sessionId}] Email sending failed for SP_ID ${internalSignatureProcessId}, but core process completed.`,
      //   );
      //   const metadataUpdate = (currentSignatureProcess.metadata as any) || {};
      //   metadataUpdate.lastEmailError = {
      //     message: mailResponse.msg,
      //     code: mailResponse.code,
      //     timestamp: new Date().toISOString(),
      //   };
      //   await this.prisma.signatureProcess.update({
      //     where: { id: currentSignatureProcess.id },
      //     data: { status: 'email_sending_failed', metadata: metadataUpdate },
      //   });
      // }
      response.code = 200;
      response.msg = 'Signature process callback processed successfully.';
      response.response = { signatureProcessId: internalSignatureProcessId };
      return response;
    } catch (error) {
      console.log('Wills Error-> c83js9as', error);
      processException(error);
    }
  }

  async sendMailWithAttachments(
    document: any,
    sessionId: string,
  ): Promise<GeneralResponseDto> {
    // bajar del s3 los dos archivos que estan como pdf
    // mandarlos por mail
    // en cuanto este encolado acutalizas el estado de envio en el campo de comunicaciones.
    const response = new GeneralResponseDto();
    try {
      const user = document.user;
      if (!user || !user.email || !user.name) {
        response.code = 404;
        response.msg = 'User email or name not found in contract metadata';
        console.log('User email or name not found in contract metadata');
        return response;
      }
      console.log('Nombre completo:', user.name);
      console.log('Correo:', user.email);
      console.log('Apellido paterno:', user.fatherLastName);
      console.log('Apellido materno:', user.motherLastName);
      const userEmail = user.email;
      const userName = user.name;
      const contractId = document.id;
      // const fatherLastName = user.fatherLastName;
      // const motherLastName = user.motherLastName;

      // Definir las claves de S3 para los dos archivos
      const seguridataPdfKey =
        user.id + '/' + user.id + '_' + document.version + '_RGCCNOM151.pdf';
      const pastpostPdfKey =
        user.id + '/' + user.id + '_' + document.version + '_PASTPOST.pdf';

      const emailEvent = {
        type: 'new',
        metadata: {
          pastpostmetadata: {
            ppObjectType: 'testamentos',
            ppObjetcId: contractId,
            authorId: user.id,
          },
          body: {
            provider: 'sendgrid',
            commType: 'email',
            data: [
              {
                msg: {
                  to: userEmail,
                  from: this.getEmailFrom,
                  templateId: this.getSgSendWills,
                  dynamicTemplateData: {
                    subject: 'Tu testamento, ya está activo',
                    from: 'Testamento',
                    to: userName,
                    mensajeTitulo: 'Mensaje de prueba',
                    mensajeDescripcion: 'Ya funciona perro.',
                  },
                  attachments: [
                    {
                      provider: 's3',
                      bucket: this.getBucketWill,
                      key: seguridataPdfKey,
                    },
                    {
                      provider: 's3',
                      bucket: this.getBucketWill,
                      key: pastpostPdfKey,
                    },
                  ],
                },
              },
            ],
          },
        },
      };

      console.log('SQS body:', JSON.stringify(emailEvent));
      console.log('Email event created, sending to SQS');
      const queueUrl = this.getSqsCommNoWaitQueue;
      const unixTimestamp = Math.floor(Date.now() / 1000);
      console.log('Unix Timestamp: MessageDeduplicationId ' + unixTimestamp);
      const messageGroupId = 'messaging_group';
      const messageDeduplicationId = unixTimestamp.toString();
      const sqsResponse = await this.sendMessagge(
        queueUrl,
        emailEvent,
        messageGroupId,
        messageDeduplicationId,
      );
      console.log('sqsResponse', sqsResponse);
      const messageId = sqsResponse.response.MessageId;

      await this.prisma.testamentHeader.update({
        where: { id: document.id },
        data: {
          communicationData: {
            emailstatus: 'queued',
            validationId: messageId,
          },
        },
      });

      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        document.userId,
        new Date(),
        '103',
        { emailEvent },
        { sqsResponse },
        'ok',
        { signatureProcessId: document.seguridataprocessid },
      );

      // Retornar una respuesta exitosa
      response.code = 200;
      response.msg = 'Email event created successfully';
      return response;
    } catch (error) {
      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        document.userId,
        new Date(),
        '103',
        { error: error || 'Unknown error' },
        {},
        'failed',
        { signatureProcessId: document.seguridataprocessid },
      );
      console.log('Error in sendMailWithAttachments:', error);
      processException(error);
    }
  }

  async sendMessagge(
    queueUrl: string,
    messageBody: any,
    messageGroupId: string,
    messageDeduplicationId: string,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    const params = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      MessageGroupId: messageGroupId,
      MessageDeduplicationId: messageDeduplicationId,
    };

    try {
      const command = new SendMessageCommand(params);
      const sendMsm = await this.sqsClient.send(command);
      console.log('SendMessage', sendMsm);
      response.code = 200;
      response.msg = 'Message Queue';
      response.response = sendMsm;
      return response;
    } catch (error) {
      console.log('Wills Error: 46f541e');
      console.error('Error sending message to SQS:', error);
      console.log(error);
      response.code = 500;
      response.msg = error.message;
      return response;
    }
  }

  async processContractProducts(contractId: string) {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaprovider.getPrismaClient();
      if (this.prisma == null) {
        response.code = 500;
        response.msg = 'error code cdnj7dw';
        console.log('Wills Error-> dhosw8');
        console.log(
          'Could not connect to DB, no prisma client created error getting secret',
        );
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const contract = await this.prisma.userPartnerProductContract.findUnique({
        where: { id: contractId },
        include: {
          service: true,
        },
      });
      if (!contract) {
        response.code = 404;
        response.msg = 'Contract not found';
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      console.log('contract', contract);

      if (contract.status !== 'Created' && contract.status !== 'Processed') {
        response.code = 400;
        response.msg = 'Contract can not be proccess' + contract.status;
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const metadata = contract.metadata;
      if (!metadata || !Array.isArray(metadata) || metadata.length === 0) {
        response.code = 400;
        response.msg =
          'Missing metadata: please provide contact list with percentages';
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const contactIds = metadata.map((item) => item.contactId);
      const contacts = await this.prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          userId: contract.userId,
        },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: contract.userId },
        include: {
          addresses: true,
        },
      });

      if (!user.addresses || user.addresses.length === 0) {
        await this.prisma.userPartnerProductContract.update({
          where: { id: contractId },
          data: { signatureStatus: 'Failed' },
        });
        response.code = 400;
        response.msg = 'User address not found, please update user info';
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const address = [
        user.addresses[0].street,
        user.addresses[0].suburb,
        user.addresses[0].city,
        user.addresses[0].state,
        user.addresses[0].country,
        user.addresses[0].zipCode,
      ]
        .filter(Boolean)
        .join(', ');
      console.log('metadata ready');

      const filePath = this.getCorrectedTemplatePath('IndexMapfre.html');
      console.log(
        '[processContractProducts] Intentando cargar plantilla desde:',
        filePath,
      );
      const pdfbaseRaw = await fs.readFile(filePath, 'utf8');
      let pdfbase = pdfbaseRaw;

      const signedDate = new Date(contract.createdAt);
      const expireDate = new Date(contract.expireDate);
      const userBirthDate = new Date(user.birthDate);

      if (isNaN(userBirthDate.getTime())) {
        await this.prisma.userPartnerProductContract.update({
          where: { id: contractId },
          data: { signatureStatus: 'Failed' },
        });
        response.code = 400;
        response.msg = 'Invalid birth date is NaN';
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const formattedSignedDate = signedDate.toLocaleDateString('es-MX');
      const formattedExpireDate = expireDate.toLocaleDateString('es-MX');
      const formattedBirthDate = userBirthDate.toLocaleDateString('es-MX');

      pdfbase = pdfbase.replace(/#\{\{policy_number\}\}#/g, '001');
      pdfbase = pdfbase.replace(/#\{\{subgroup\}\}#/g, 'testamentos.mx');
      pdfbase = pdfbase.replace(/#\{\{user_address\}\}#/g, address);
      pdfbase = pdfbase.replace(
        /#\{\{policy_expedition_date\}\}#/g,
        formattedSignedDate,
      );
      pdfbase = pdfbase.replace(
        /#\{\{policy_expiry_date\}\}#/g,
        formattedExpireDate,
      );
      pdfbase = pdfbase.replace(
        /#\{\{certificate_expedition_date\}\}#/g,
        formattedSignedDate,
      );
      pdfbase = pdfbase.replace(
        /#\{\{certificate_expiry_date\}\}#/g,
        formattedExpireDate,
      );
      pdfbase = pdfbase.replace(
        /#\{\{insurance_plan_selected\}\}#/g,
        contract.service?.name ?? '',
      );
      pdfbase = pdfbase.replace(/#\{\{user_name\}\}#/g, user.name);
      pdfbase = pdfbase.replace(
        /#\{\{user_fatherLastName\}\}#/g,
        user.fatherLastName ?? '',
      );
      pdfbase = pdfbase.replace(
        /#\{\{user_motherLastName\}\}#/g,
        user.motherLastName ?? '',
      );
      pdfbase = pdfbase.replace(
        /#\{\{user_country\}\}#/g,
        user.nationality ?? '',
      );
      pdfbase = pdfbase.replace(
        /#\{\{user_TaxRegistrationNumber\}\}#/g,
        'PruebaSeguro',
      );
      pdfbase = pdfbase.replace(
        /#\{\{user_birth_date\}\}#/g,
        formattedBirthDate,
      );
      pdfbase = pdfbase.replace(/#\{\{user_sex\}\}#/g, user.gender ?? '');
      pdfbase = pdfbase.replace(
        /#\{\{user_civil_state\}\}#/g,
        user.maritalstatus ?? '',
      );

      for (let i = 0; i < 5; i++) {
        const meta = metadata[i];
        const fix = i + 1;

        let name = '---------';
        let relation = '---------';
        let perc = '---------';
        let birth = '---------';
        const address = 'NO Disponible ahora';

        if (meta) {
          const contact = contacts.find((c) => c.id === meta.contactId);
          if (contact) {
            name =
              `${contact.name} ${contact.fatherLastName ?? ''} ${contact.motherLastName ?? ''}`.trim();
            relation = contact.relationToUser ?? '---------';
            perc = meta.percentage?.toString() ?? '---------';
            birth = contact.birthDate
              ? new Date(contact.birthDate).toLocaleDateString('es-MX')
              : '---------';
          }
        }

        pdfbase = pdfbase.replace(
          new RegExp(`#\\{\\{dependant_name_${fix}\\}\\}#`, 'g'),
          name,
        );
        pdfbase = pdfbase.replace(
          new RegExp(`#\\{\\{dependant_relationship_${fix}\\}\\}#`, 'g'),
          relation,
        );
        pdfbase = pdfbase.replace(
          new RegExp(`#\\{\\{dependant_percentage_${fix}\\}\\}#`, 'g'),
          perc,
        );
        pdfbase = pdfbase.replace(
          new RegExp(`#\\{\\{dependant_birthday_${fix}\\}\\}#`, 'g'),
          birth,
        );
        pdfbase = pdfbase.replace(
          new RegExp(`#\\{\\{beneficiaries_adress_${fix}\\}\\}#`, 'g'),
          address,
        );
      }

      const htmlKey = contract.id + '/' + contract.id + '.html';
      const pdfKey = contract.id + '/' + contract.id + '.pdf';
      const bucketName = this.getBucketWill;
      const params = {
        Bucket: bucketName,
        Key: htmlKey,
        Body: pdfbase,
        ContentType: 'text/html',
      };

      const s3Client = this.s3Client;
      try {
        await s3Client.send(new PutObjectCommand(params));
      } catch (err) {
        await this.prisma.userPartnerProductContract.update({
          where: { id: contractId },
          data: { signatureStatus: 'Failed' },
        });
        throw err;
      }

      const queueUrl = process.env.QUEUE_GENERATE_PDF;
      console.log(`[handlePdfProcess] Enqueuing message to SQS =>`, queueUrl);
      const payload = {
        html: { bucket: bucketName, key: htmlKey },
        pdf: { bucket: bucketName, key: pdfKey },
        proccesId: contract.id,
      };
      try {
        await this.sqsService.sendMessage(queueUrl, payload);
      } catch (err) {
        await this.prisma.userPartnerProductContract.update({
          where: { id: contractId },
          data: { signatureStatus: 'Failed' },
        });
        throw err;
      }
      console.log(`[handlePdfProcess] Sent message to SQS =>`, payload);

      console.log('File html uploaded successfully:', response);
      console.log('setting contract status to processed');
      await this.prisma.userPartnerProductContract.update({
        where: { id: contractId },
        data: {
          status: 'Processed',
        },
      });
      console.log('We responded with ' + JSON.stringify(response));
      response.code = 201;
      response.msg = 'Datos procesados y encolados para conversión PDF.';
      response.response = { htmlKey, pdfKey };
      console.log('[handlePdfProcess] Response =>', response);
      return response;
    } catch (error) {
      await this.prisma.userPartnerProductContract.update({
        where: { id: contractId },
        data: { signatureStatus: 'Failed' },
      });
      console.log('Error -> bck3d', error);
      processException(error);
    }
  }

  private getCorrectedTemplatePath(templateName: string): string {
    let baseDirForTemplates = __dirname;
    console.log('[getCorrectedTemplatePath] __dirname inicial:', __dirname);

    const problematicPathSuffix = path.join('dist', 'src', 'testament-pdf');

    if (
      process.env.environment !== 'prod' &&
      __dirname.endsWith(problematicPathSuffix)
    ) {
      console.warn(
        `[Local Debug Path Correction] __dirname (${__dirname}) parece estar en la estructura dist/src. Ajustando...`,
      );
      const parts = __dirname.split(path.sep);
      const srcIndex = parts.lastIndexOf('src');
      const distIndex = parts.lastIndexOf('dist');

      if (srcIndex > distIndex && distIndex !== -1) {
        parts.splice(srcIndex, 1);
        baseDirForTemplates = parts.join(path.sep);
        console.warn(
          `[Local Debug Path Correction] Nuevo baseDirForTemplates: ${baseDirForTemplates}`,
        );
      } else {
        console.error(
          `[Local Debug Path Correction] No se pudo ajustar la ruta como se esperaba. path: ${__dirname}`,
        );
      }
    }
    return path.join(baseDirForTemplates, 'templates', templateName);
  }
}
