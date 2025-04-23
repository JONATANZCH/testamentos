import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PdfProcessRepository } from './rempository/pdf-process.repository';
import { GeneralResponseDto } from '../common/response.dto';
import { PrismaProvider } from '../providers';
import { processException } from '../common/utils/exception.helper';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import * as qs from 'qs';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '../config';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { SqsService } from '../config/sqs-validate.service';
import { HtmlGeneratorService } from './htmlGenerator.service';
import { v4 as uuidv4 } from 'uuid';
import { HttpService } from '@nestjs/axios';

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

  constructor(
    private readonly pdfProcessRepository: PdfProcessRepository,
    private readonly prismaprovider: PrismaProvider,
    private readonly configService: ConfigService,
    private readonly nestConfigService: NestConfigService,
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
      this.nestConfigService.get<string>('SIGNER_URL_BASE') ?? '';
    this.signer_base_rest = (this.signer_base ?? '') + '/rest';
    this.signer_authorization =
      this.nestConfigService.get<string>('SIGNER_AUTHORIZATION') ?? '';
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
      htmlKey: `${userId}_${version}.html`,
      pdfKey: `${userId}_${version}.pdf`,
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
      const resultvalidates3 = await this.getFileFromS3(
        this.getBucketWill,
        contract.userId + '_' + contract.version + '.pdf',
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
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '0',
          {},
          { error: 'Contract already signed' },
          'failed',
        );
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }
      await this.sendSignatureLog(
        sessionId,
        contract.userId,
        testamentId,
        new Date(),
        '0',
        {},
        { message: 'starting signature process.', url: this.signer_base_rest },
        'ok',
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
      let result = await this.makePostRequest(url1, body, headers, true);
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
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '1',
          body,
          result,
          'failed',
        );
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      await this.sendSignatureLog(
        sessionId,
        contract.userId,
        testamentId,
        new Date(),
        '1',
        body,
        result,
        'ok',
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
        result = await this.makePostRequest(url2, body2, headers, true);
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
          await this.sendSignatureLog(
            sessionId,
            contract.userId,
            testamentId,
            new Date(),
            '2',
            body2,
            result,
            'failed',
          );
          console.log('we responded with ' + JSON.stringify(response));
          throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        console.log('process created' + JSON.stringify(result));
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '2',
          body2,
          result,
          'ok',
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
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '2',
          seguridataprocessid,
          {
            info: 'contract alredy had a processid, steps to create NEW process discarded',
          },
          'ok',
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

        result = await this.postFileAsFormData(
          url3,
          this.getBucketWill,
          contract.userId + '_' + contract.version + '.pdf',
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
          await this.sendSignatureLog(
            sessionId,
            contract.userId,
            testamentId,
            new Date(),
            '3',
            formData,
            result,
            'failed',
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
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '3',
          formData,
          result,
          'ok',
        );
      } else {
        console.log('file already added to process we will not add it again');
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '3',
          {},
          'file already added to process',
          'ok',
        );
      }
      //////////4//////////////////////// AGREGAR TITULO DE EXPENDIENTE
      if (!seguridataprocessinfo || !seguridataprocessinfo[0].title) {
        console.log('setting title');
        const url4 = this.signer_base_rest + '/process/update';
        const body4 = {
          idprc: parseInt(seguridataprocessid, 10),
          fld: 'p8',
          data: contract.testamentId + '.pdf',
          tipo: 0,
        };
        result = await this.makePostRequest(url4, body4, headers, true);
        if (
          result.code != 200 ||
          (typeof result.response == 'string' &&
            result.response.toLowerCase().includes('error'))
        ) {
          console.log('result ->' + result.response);
          console.log('error setting title. sessionId ->' + sessionId);
          response.code = 500;
          response.msg = 'Error signing contract - SessionId-> ' + sessionId;
          await this.sendSignatureLog(
            sessionId,
            contract.userId,
            testamentId,
            new Date(),
            '4',
            body4,
            result,
            'failed',
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
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '4',
          body4,
          result,
          'ok',
        );
      } else {
        console.log('title already added to process we will not add it again');
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '4',
          {},
          'title already added to process',
          'ok',
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
        result = await this.makePostRequest(url5, body5, headers, true);
        if (
          result.code != 200 ||
          (typeof result.response == 'string' &&
            result.response.toLowerCase().includes('error'))
        ) {
          console.log('result ->' + result.response);
          console.log('error setting firmantes. sessionId ->' + sessionId);
          response.code = 500;
          response.msg = 'error setting firmantes 5 - SessionId-> ' + sessionId;
          await this.sendSignatureLog(
            sessionId,
            contract.userId,
            testamentId,
            new Date(),
            '5',
            body5,
            result,
            'failed',
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
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '5',
          body5,
          result,
          'ok',
        );
      } else {
        console.log(
          'firmantes already added to process we will not add it again',
        );
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '5',
          {},
          'firmantes already added to process',
          'ok',
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
      result = await this.makePostRequest(url6, body6, headers, true);
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
        await this.sendSignatureLog(
          sessionId,
          contract.userId,
          testamentId,
          new Date(),
          '6',
          body6,
          result,
          'failed',
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
      await this.sendSignatureLog(
        sessionId,
        contract.userId,
        testamentId,
        new Date(),
        '6',
        body6,
        result,
        'ok',
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

  private async getFileFromS3(
    bucketName: string,
    key: string,
  ): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    let data;
    try {
      data = await this.s3Client.send(command);
    } catch (error) {
      console.log('Wills Error-> 2s2z8s2w');
      console.error('Error getting file from S3:', error);
      return null;
    }
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      (data.Body as Readable).on('data', (chunk) => chunks.push(chunk));
      (data.Body as Readable).on('end', () => resolve(Buffer.concat(chunks)));
      (data.Body as Readable).on('error', reject);
    });
  }

  async sendSignatureLog(
    sessionId: string,
    userId: number,
    testamentId: string,
    date: Date,
    step: string,
    sendMetadata: any,
    responseMetadata: any,
    status: string,
  ) {
    try {
      const s = status.toLowerCase();
      if (s !== 'ok') {
        try {
          const errormsg =
            'Error in seguridata in ENVIRONMENT ' +
            this.environment +
            '. \n Process for testament: ' +
            testamentId +
            ' \n - step:' +
            step +
            ' \n- status:' +
            status +
            ' \n- sessionId: ' +
            sessionId +
            ' \n- userId: ' +
            userId +
            ' \n- date: ' +
            date +
            ' \n-  sendMetadata : ' +
            JSON.stringify(sendMetadata) +
            ' \n- responseMetadata: ' +
            JSON.stringify(responseMetadata);
          // await this.httpservice.sendSnsMessage(
          //   errormsg,
          //   this._pastposterror_sns_topic_arn,
          // );
          console.log('SNS message sent' + errormsg);
        } catch (error) {
          console.log('Error sending SNS message:', error);
        }
      }
      await this.prisma.signatureStatus.create({
        data: {
          signSession: sessionId,
          userId: userId,
          testamentId: testamentId,
          date: date,
          step: step,
          sendMetadata: sendMetadata,
          responseMetadata: responseMetadata,
          status: status,
        },
      });
      return true;
    } catch (error) {
      console.log('wills Error-> sdf2');
      console.log('Error creating Log of Signature', error);
      return false;
    }
  }

  async makePostRequest(
    url: string,
    data: any,
    headers: any,
    isUrlEncoded: boolean = false,
  ): Promise<any> {
    const responseg = new GeneralResponseDto();
    try {
      if (isUrlEncoded) {
        data = qs.stringify(data);
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      const response = await firstValueFrom(
        this.httpService.post(url, data, { headers }),
      );
      responseg.code = response.status;
      responseg.msg = 'Request successful';
      responseg.response = response.data;
      return responseg;
    } catch (error) {
      console.log('Wills Error-> j20xk2y');
      responseg.code = 500;
      responseg.msg = 'Error making POST request';
      responseg.response = error;
      console.error('Error making POST request:', error);
      return responseg;
    }
  }

  async postFileAsFormData(
    url: string,
    bucketName: string,
    key: string,
    headers: any,
    formData: any,
  ): Promise<any> {
    const responseg = new GeneralResponseDto();
    try {
      // Obtener el archivo desde S3
      const fileBuffer = await this.getFileFromS3(bucketName, key);
      if (!fileBuffer) {
        console.log(`Archivo ${key} no encontrado en S3`);
        responseg.code = 404;
        responseg.msg = 'File not found in S3';
        return responseg;
      }
      console.log(
        `Archivo ${key} encontrado en S3 de tamaño ${fileBuffer.length} bytes`,
      );
      // Preparar el archivo en form-data
      const form = new FormData();
      form.append('pze', fileBuffer, { filename: key });
      for (let index = 0; index < formData.length; index++) {
        const element = formData[index];
        //form.append('idprc', idprc);
        form.append(element.key, element.value);
      }
      // Añadir encabezados necesarios para form-data
      const formHeaders = form.getHeaders();
      headers = { ...headers, ...formHeaders };

      // Enviar la solicitud POST con el archivo en form-data
      const response = await firstValueFrom(
        this.httpService.post(url, form, { headers }),
      );
      if (response.data === 1) {
        responseg.code = 200;
        responseg.msg = 'File posted as form-data';
      } else {
        responseg.code = 500;
        responseg.msg = 'Error posting file as form-data';
      }
      responseg.response = response.data;

      return responseg;
    } catch (error) {
      console.log('Pastpost Error-> hsiahx7s');
      console.error('Error posting file as form-data', error);
      responseg.code = 500;
      responseg.msg = 'Error posting file as form-data';
      responseg.response = error;
      console.error('Error posting file as form-data:', error);
      return responseg;
    }
  }
}
