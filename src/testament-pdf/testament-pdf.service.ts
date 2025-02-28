import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PdfProcessRepository } from './rempository/pdf-process.repository';
import { GeneralResponseDto } from '../common/response.dto';
import { PrismaProvider } from '../providers';
import { processException } from '../common/utils/exception.helper';
import { ConfigService } from '../config';
import { SqsService } from '../config/sqs-validate.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

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
        response.msg = 'Failed to get Prisma instance.';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
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

      const user = await this.prisma.user.findUnique({
        where: { id: processRecord.userId },
        include: {
          addresses: true,
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
          testamentHeaders: {
            include: {
              Executor: {
                include: { contact: true },
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
            },
          },
          pets: true,
          termsAndOffers: true,
        },
      });

      if (!user) {
        response.code = 404;
        response.msg = `User whit id: ${processRecord.userId} not found`;
        console.log(
          `[handlePdfProcess] user not found -> userId=${processRecord.userId}`,
        );
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }
      console.log(`[handlePdfProcess] user =>`, user);

      const documentNumber = uuidv4();
      const dateSignature = new Date().toLocaleString('es-MX', {
        timeZone: 'UTC',
        dateStyle: 'long',
        timeStyle: 'short',
      });

      // Calcula la edad
      let ageString = '';
      if (user.birthDate) {
        const now = new Date();
        const birth = new Date(user.birthDate);
        let age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
          age--;
        }
        ageString = age.toString();
      }

      let addressStr = '';
      if (user.addresses && user.addresses.length > 0) {
        const addr = user.addresses[0];
        addressStr = [
          addr.street,
          addr.city,
          addr.state,
          addr.zipCode,
          addr.country,
        ]
          .filter(Boolean)
          .join(', ');
      }

      const placeholdersSec1 = {
        document_number: documentNumber,
        date_and_time_SIGNATURE: dateSignature,
        name: user.name || '',
        fatherLastName: user.fatherLastName || '',
        motherLastName: user.motherLastName || '',
        nationality: user.nationality || '',
        martial_status: user.maritalstatus || '',
        address: addressStr,
        age: ageString,
        job: 'PENDING',
        id_type: 'PENDING',
        id_number: 'PENDING',
      };
      console.log(`[handlePdfProcess] placeholdersSec1 =>`, placeholdersSec1);

      const testamentHeader = user.testamentHeaders
        ? user.testamentHeaders[user.testamentHeaders.length - 1]
        : null;
      if (testamentHeader) {
        console.log(
          `[handlePdfProcess] Found testamentHeader =>`,
          testamentHeader,
        );
      } else {
        console.log(`[handlePdfProcess] No testamentHeader found for user.`);
      }

      let albacea_name = '';
      let albacea_fatherLastName = '';
      let albacea_motherLastName = '';
      let albacea_subtitue_name = '';
      let albacea_subtitue_fatherLastName = '';
      let albacea_subtitue_motherLastName = '';

      if (testamentHeader && testamentHeader.Executor.length > 0) {
        // Tomamos dos; primero principal, segundo sustituto
        const [execOne, execTwo] = testamentHeader.Executor;

        if (execOne) {
          albacea_name = execOne.contact.name || '';
          albacea_fatherLastName = execOne.contact.fatherLastName || '';
          albacea_motherLastName = execOne.contact.motherLastName || '';
        }
        if (execTwo) {
          albacea_subtitue_name = execTwo.contact.name || '';
          albacea_subtitue_fatherLastName =
            execTwo.contact.fatherLastName || '';
          albacea_subtitue_motherLastName =
            execTwo.contact.motherLastName || '';
        }
      }

      const placeholdersSec3 = {
        albacea_name,
        albacea_fatherLastName,
        albacea_motherLastName,
        albacea_subtitue_name,
        albacea_subtitue_fatherLastName,
        albacea_subtitue_motherLastName,
      };

      let placeholdersSec4: Record<string, string> = {
        relation_to_user: '',
        beneficiarie_name: '',
        beneficiarie_fatherLastName: '',
        beneficiarie_motherLastName: '',
        id_type_beneficiarie: '',
        id_number_beneficiarie: '',
        asset_percentage_beneficiarie: '',
        asset_name_beneficiarie: '',
      };

      if (testamentHeader && testamentHeader.TestamentAssignment.length > 0) {
        const assignment = testamentHeader.TestamentAssignment[0];
        let beneficiaryName = '';
        let beneficiaryFather = '';
        let beneficiaryMother = '';
        let relationToUser = '';
        const assetPercent = assignment.percentage.toString();
        const assetName = assignment.asset?.name || '';

        // Distinguimos c->Contact, le->LegalEntity
        if (assignment.assignmentType === 'c') {
          const contactId = assignment.assignmentId;
          const contact = user.contacts.find((c) => c.id === contactId);
          if (contact) {
            beneficiaryName = contact.name || '';
            beneficiaryFather = contact.fatherLastName || '';
            beneficiaryMother = contact.motherLastName || '';
            relationToUser = contact.relationToUser || '';
          }
        } else if (assignment.assignmentType === 'le') {
          const entityId = assignment.assignmentId;
          const entity = await this.prisma.legalEntity.findUnique({
            where: { id: entityId },
          });

          if (entity) {
            beneficiaryName = entity.name || '';
            beneficiaryFather = '';
            beneficiaryMother = '';
            relationToUser = 'Legal Entity';
          } else {
            beneficiaryName = 'Entity not found';
            beneficiaryFather = '';
            beneficiaryMother = '';
            relationToUser = 'Legal Entity';
          }
        }

        placeholdersSec4 = {
          relation_to_user: relationToUser,
          beneficiarie_name: beneficiaryName,
          beneficiarie_fatherLastName: beneficiaryFather,
          beneficiarie_motherLastName: beneficiaryMother,
          id_type_beneficiarie: 'PENDING',
          id_number_beneficiarie: 'PENDING',
          asset_percentage_beneficiarie: assetPercent,
          asset_name_beneficiarie: assetName,
        };
      }

      const digitalAssignments = testamentHeader.TestamentAssignment.filter(
        (assign) => {
          return assign.asset?.category?.type === 'digital';
        },
      );

      const placeholdersSec5Legados = {
        asset_notes: '',
        legay_name: '',
        legay_fatherLastName: '',
        legacy_motherLastName: '',
        id_type_legacy: '',
        id_number_legacy: '',
      };

      const placeholdersSec6Fideicomiso = {
        parentesco_fideicomiso1: '',
        nombre_heredero1_fideicomiso: '',
        tipo_identificacion1_fideicomiso: '',
        numero_identificacion1_fideicomiso: '',
        porcentaje_heredero1_fideicomiso: '',
        bien_heredero1_fideicomiso: '',

        parentesco_fideicomiso2: '',
        nombre_heredero2_fideicomiso: '',
        tipo_identificacion2_fideicomiso: '',
        numero_identificacion2_fideicomiso: '',
        porcentaje_heredero2_fideicomiso: '',
        bien_heredero2_fideicomiso: '',

        parentesco_fideicomiso3: '',
        nombre_heredero3_fideicomiso: '',
        tipo_identificacion3_fideicomiso: '',
        numero_identificacion3_fideicomiso: '',
        porcentaje_heredero3_fideicomiso: '',
        bien_heredero3_fideicomiso: '',

        nombre_testador_fideicomiso: user.name || '',
        nombre_fiduciario_fideicomiso: '',
        beneficiarios_fideicomiso: '',
        finalidad_fideicomiso: '',
        duracion_fideicomiso: '',
      };

      const templatePath = path.join(
        __dirname,
        'templates',
        'CleanTestamentoHTMLTable.html',
      );
      let htmlBase = await fs.readFile(templatePath, 'utf8');

      for (const [key, value] of Object.entries(placeholdersSec1)) {
        const regex = new RegExp(`#\\{\\{${key}\\}\\}#`, 'g');
        htmlBase = htmlBase.replace(regex, value);
      }

      for (const [key, value] of Object.entries(placeholdersSec3)) {
        const regex = new RegExp(`#\\{\\{${key}\\}\\}#`, 'g');
        htmlBase = htmlBase.replace(regex, value);
      }

      for (const [key, value] of Object.entries(placeholdersSec4)) {
        const regex = new RegExp(`#\\{\\{${key}\\}\\}#`, 'g');
        htmlBase = htmlBase.replace(regex, value);
      }

      for (const [key, value] of Object.entries(placeholdersSec5Legados)) {
        const regex = new RegExp(`#\\{\\{${key}\\}\\}#`, 'g');
        htmlBase = htmlBase.replace(regex, value);
      }

      for (const [key, value] of Object.entries(placeholdersSec6Fideicomiso)) {
        const regex = new RegExp(`#\\{\\{${key}\\}\\}#`, 'g');
        htmlBase = htmlBase.replace(regex, value);
      }

      let digitalAssetsHtml_1 = '';
      let digitalAssetsHtml_2 = '';

      for (let i = 0; i < digitalAssignments.length; i++) {
        const assign = digitalAssignments[i];

        const assetName = assign.asset?.name;

        let beneficiaryName = '';
        let beneficiaryFather = '';
        let beneficiaryMother = '';
        let relation = '';
        let govId = 'PENDING';

        if (assign.assignmentType === 'c') {
          const contactId = assign.assignmentId;
          const contact = user.contacts.find((c) => c.id === contactId);
          if (contact) {
            beneficiaryName = contact.name ?? '';
            beneficiaryFather = contact.fatherLastName ?? '';
            beneficiaryMother = contact.motherLastName ?? '';
            relation = contact.relationToUser ?? '';
            if (contact.governmentId) govId = contact.governmentId;
          }
        } else if (assign.assignmentType === 'le') {
          const entityId = assign.assignmentId;
          const entity = await this.prisma.legalEntity.findUnique({
            where: { id: entityId },
          });
          if (entity) {
            beneficiaryName = entity.name;
            relation = 'Legal Entity';
          }
        }

        const fullName = [beneficiaryName, beneficiaryFather, beneficiaryMother]
          .filter(Boolean)
          .join(' ');

        const itemHtml = `
          <li>
            <strong>${assetName}</strong> será legado a
            <strong>${relation}</strong>, <strong>${fullName}</strong>,
            con identificación <strong>ID ${govId}</strong>.
          </li>
        `;

        if (i % 2 === 0) {
          digitalAssetsHtml_1 += itemHtml;
        } else {
          digitalAssetsHtml_2 += itemHtml;
        }
      }

      htmlBase = htmlBase.replace(
        '#{{digital_assets_loop}}#',
        digitalAssetsHtml_1 || '',
      );
      htmlBase = htmlBase.replace(
        '#{{digital_assets_loop_2}}#',
        digitalAssetsHtml_2 || '',
      );

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
      const htmlKey = `${processRecord.userId}_${processRecord.version}.html`;
      const s3Client = new S3Client({});
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
      const payload = {
        html: { bucket: bucketName, key: htmlKey },
        pdf: { bucket: bucketName, key: pdfProcessId + '.pdf' },
      };
      await this.sqsService.sendMessage(queueUrl, payload);
      console.log(`[handlePdfProcess] Sent message to SQS =>`, payload);

      response.code = 200;
      response.msg = 'Sección 1 generada y encolada para conversión PDF.';
      response.response = { pdfProcessId };
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
    const pathReq = `/${this.environment}/wills/users/${userId}/testaments/processpdf`;

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

    const queueUrl = process.env.QUEUE_PROCESS_PDF;
    await this.sqsService.sendMessage(queueUrl, sqsBody);
    console.log(
      `[enqueuePdfProcess] SQS message enqueued for pdfProcessId=${processId}`,
    );
  }
}
