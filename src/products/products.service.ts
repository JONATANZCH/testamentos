import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaProvider } from '../providers';
import { GeneralResponseDto } from '../common';
import { processException } from '../common/utils/exception.helper';
import { CreateUserPartnerProductDto } from './dto/create-user-partner-product.dto';
import { UpdateUserPartnerProductDto } from './dto/update-user-partner-product.dto';
import { SharedOperationsService } from '../config/shared-operations.service';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '../config';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { CreateSignPdfDto } from '../common/dto/create-sign-pdf.dto';

@Injectable()
export class ProductsService {
  private prisma: any = null;
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

  constructor(
    private readonly prismaProvider: PrismaProvider,
    private readonly sharedOperationsService: SharedOperationsService,
    private readonly configService: ConfigService,
    private readonly nestConfigService: NestConfigService,
  ) {
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
  }

  async getAllProducts(
    userId: string,
    page: number,
    limit: number,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) {
        console.log('Wills Error-> db-connection-failed');
        response.code = 500;
        response.msg = 'Could not connect to the database';
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const pageNumber = parseInt(String(page), 10);
      const limitNumber = parseInt(String(limit), 10);

      if (isNaN(pageNumber) || isNaN(limitNumber)) {
        response.code = 400;
        response.msg = 'Page and limit must be valid numbers';
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }

      const offset = (pageNumber - 1) * limitNumber;

      const [records, total] = await this.prisma.$transaction([
        this.prisma.userPartnerProductContract.findMany({
          where: { userId },
          skip: offset,
          take: limitNumber,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            serviceId: true,
            status: true,
            signatureStatus: true,
            expireDate: true,
            createdAt: true,
            updatedAt: true,
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                type: true,
                country: true,
              },
            },
          },
        }),
        this.prisma.userPartnerProductContract.count({
          where: { userId },
        }),
      ]);

      if (total === 0) {
        response.code = 404;
        response.msg = 'No product subscriptions found';
        response.response = {};
        throw new HttpException(response, HttpStatus.NOT_FOUND);
      }

      response.code = 200;
      response.msg = 'Partner product subscriptions retrieved';
      response.response = {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        records,
      };
      return response;
    } catch (err) {
      processException(err);
    }
  }

  async createUserProductSubscription(
    userId: string,
    dto: CreateUserPartnerProductDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) throw new Error('DB connection error wills -> dwpno8');

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user)
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);

      const service = await this.prisma.services.findFirst({
        where: { id: dto.serviceId, type: 'partnerProduct' },
      });
      if (!service)
        throw new HttpException('ServiceId not Found', HttpStatus.BAD_REQUEST);

      if (!Array.isArray(dto.metadata)) {
        throw new HttpException(
          'metadata must be an array of contact references',
          HttpStatus.BAD_REQUEST,
        );
      }

      const contactIds = dto.metadata.map((item) => item.contactId);
      const contacts = await this.prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          userId,
        },
      });

      if (contacts.length !== contactIds.length) {
        const foundIds = new Set(contacts.map((c) => c.id));
        const missingIds = contactIds.filter((id) => !foundIds.has(id));
        throw new HttpException(
          `Invalid contactId(s): ${missingIds.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const record = await this.prisma.userPartnerProductContract.create({
        data: {
          userId,
          serviceId: dto.serviceId,
          metadata: dto.metadata,
          status: 'Created',
          expireDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
        },
        select: {
          id: true,
          userId: true,
          serviceId: true,
          metadata: true,
          status: true,
          expireDate: true,
        },
      });

      response.code = 201;
      response.msg = 'Partner product subscription created';
      response.response = record;
      return response;
    } catch (err) {
      processException(err);
    }
  }

  async updateUserProductsSubscription(
    contractId: string,
    dto: UpdateUserPartnerProductDto,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) throw new Error('DB connection error wills -> dsvbo8');

      const exists = await this.prisma.userPartnerProductContract.findUnique({
        where: { id: contractId },
      });
      if (!exists)
        throw new HttpException('Record not found', HttpStatus.NOT_FOUND);

      const updated = await this.prisma.userPartnerProductContract.update({
        where: { id: contractId },
        data: dto,
      });

      response.code = 200;
      response.msg = 'Partner product subscription updated';
      response.response = updated;
      return response;
    } catch (err) {
      processException(err);
    }
  }

  async processContract(userId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma) throw new Error('DB connection error wills -> dsvbo8');

      const exists = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!exists)
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'active',
        },
      });
      response.code = 200;
      response.msg = 'User status updated to active';
      response.response = updated;
      return response;
    } catch (err) {
      processException(err);
    }
  }

  async signProductContract(contractId: string): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    const sessionId = uuidv4();
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (this.prisma == null) {
        response.code = 500;
        response.msg = 'error code csnjl7';
        console.log('Pastpost Error-> 234sa2ga1');
        console.log(
          'Could not connect to DB, no prisma client created error getting secret',
        );
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const contract =
        await this.prisma.userPartnerProductContract.findUniqueOrThrow({
          where: { id: contractId },
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
      const folder = `${contract.id}/`;
      const resultvalidates3 = await this.sharedOperationsService.getFileFromS3(
        this.getBucketWill,
        `${folder}${contract.id}.pdf`,
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
          contract.id +
          ' - userId=' +
          contract.userId +
          ' - folder=' +
          folder +
          ' - bucket=' +
          this.getBucketWill,
      );

      console.log('got contract info');
      const metadata = contract.signatureMetadata ?? {};
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
          contract.userId,
          new Date(),
          '0',
          {},
          { error: 'Contract already signed' },
          'failed',
          { contractId: contract.id },
        );
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.BAD_REQUEST);
      }
      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        contract.userId,
        new Date(),
        '0',
        {},
        { message: 'starting signature process.', url: this.signer_base_rest },
        'ok',
        { contractId: contract.id },
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
          contract.userId,
          new Date(),
          '1',
          body,
          result,
          'failed',
          { contractId: contract.id },
        );
        console.log('we responded with ' + JSON.stringify(response));
        throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        contract.userId,
        new Date(),
        '1',
        body,
        result,
        'ok',
        { contractId: contract.id },
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
            contract.userId,
            new Date(),
            '2',
            body2,
            result,
            'failed',
            { contractId: contract.id },
          );
          console.log('we responded with ' + JSON.stringify(response));
          throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        console.log('process created' + JSON.stringify(result));
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          contract.userId,
          new Date(),
          '2',
          body2,
          result,
          'ok',
          { contractId: contract.id },
        );
        seguridataprocessid = result.response;
        const info = {
          date: new Date(),
          seguridataprocessid: seguridataprocessid,
        };
        metadata.signprocessinfo = [];
        metadata.signprocessinfo.push(info);
        const c = await this.prisma.userPartnerProductContract.update({
          where: { id: contractId },
          data: {
            signatureMetadata: metadata,
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
          contract.userId,
          new Date(),
          '2',
          seguridataprocessid,
          {
            info: 'contract alredy had a processid, steps to create NEW process discarded',
          },
          'ok',
          { contractId: contract.id },
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
          `${folder}${contract.id}.pdf`,
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
            contract.userId,
            new Date(),
            '3',
            formData,
            result,
            'failed',
            { contractId: contract.id },
          );
          console.log('we responded with ' + JSON.stringify(response));
          throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        metadata.signprocessinfo[0].fileadded = true;
        seguridataprocessinfo[0].fileadded = true;
        await this.prisma.userPartnerProductContract.update({
          where: { id: contractId },
          data: {
            signatureMetadata: metadata,
          },
        });
        console.log('file added to process');
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          contract.userId,
          new Date(),
          '3',
          formData,
          result,
          'ok',
          { contractId: contract.id },
        );
      } else {
        console.log('file already added to process we will not add it again');
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          contract.userId,
          new Date(),
          '3',
          {},
          'file already added to process',
          'ok',
          { contractId: contract.id },
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
          await this.sharedOperationsService.sendSignatureLog(
            sessionId,
            contract.userId,
            new Date(),
            '4',
            body4,
            result,
            'failed',
            { contractId: contract.id },
          );
          console.log('we responded with ' + JSON.stringify(response));
          throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        metadata.signprocessinfo[0].title = true;
        seguridataprocessinfo[0].title = true;
        await this.prisma.userPartnerProductContract.update({
          where: { id: contractId },
          data: {
            signatureMetadata: metadata,
          },
        });
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          contract.userId,
          new Date(),
          '4',
          body4,
          result,
          'ok',
          { contractId: contract.id },
        );
      } else {
        console.log('title already added to process we will not add it again');
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          contract.userId,
          new Date(),
          '4',
          {},
          'title already added to process',
          'ok',
          { contractId: contract.id },
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
            contract.userId,
            new Date(),
            '5',
            body5,
            result,
            'failed',
            { contractId: contract.id },
          );
          console.log('we responded with ' + JSON.stringify(response));
          throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
        }
        metadata.signprocessinfo[0].firmantes = true;
        await this.prisma.userPartnerProductContract.update({
          where: { id: contractId },
          data: {
            signatureMetadata: metadata,
          },
        });
        seguridataprocessinfo[0].firmantes = true;
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          contract.userId,
          new Date(),
          '5',
          body5,
          result,
          'ok',
          { contractId: contract.id },
        );
      } else {
        console.log(
          'firmantes already added to process we will not add it again',
        );
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          contract.userId,
          new Date(),
          '5',
          {},
          'firmantes already added to process',
          'ok',
          { contractId: contract.id },
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
          contract.userId,
          new Date(),
          '6',
          body6,
          result,
          'failed',
          { contractId: contract.id },
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
        contract.userId,
        new Date(),
        '6',
        body6,
        result,
        'ok',
        { contractId: contract.id },
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

  private createError(
    response: GeneralResponseDto,
    code: number,
    msg: string,
    logCode: string,
    sessionId: string,
  ): HttpException {
    response.code = code;
    response.msg = `${msg} - SessionId-> ${sessionId}`;
    console.error(`[${sessionId}] Error ${logCode}: ${msg}`);
    throw new HttpException(response, code);
  }

  async signPdf(dto: CreateSignPdfDto): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    const sessionId = uuidv4();
    const { processtosign } = dto;
    try {
      this.prisma = await this.prismaProvider.getPrismaClient();
      if (!this.prisma)
        throw new HttpException('DB error', HttpStatus.INTERNAL_SERVER_ERROR);

      console.log(`[${sessionId}] Starting signPdf process with DTO:`, dto);
      const firstProcessItem = processtosign[0];
      let userId: string | null = null;
      console.log(
        `[${sessionId}] Getting userId from first item:`,
        firstProcessItem,
      );

      if (firstProcessItem.type === 'will') {
        const testament = await this.prisma.testamentHeader.findUnique({
          where: { id: firstProcessItem.id },
          select: { userId: true },
        });
        if (!testament) {
          throw this.createError(
            response,
            404,
            `Testament with ID ${firstProcessItem.id} not found.`,
            'WILL_NOT_FOUND',
            sessionId,
          );
        }
        userId = testament.userId;
      } else if (firstProcessItem.type === 'insurance') {
        const contract =
          await this.prisma.userPartnerProductContract.findUnique({
            where: { id: firstProcessItem.id },
            select: { userId: true },
          });
        if (!contract) {
          throw this.createError(
            response,
            404,
            `Contract with ID ${firstProcessItem.id} not found.`,
            'CONTRACT_NOT_FOUND',
            sessionId,
          );
        }
        userId = contract.userId;
      } else {
        throw this.createError(
          response,
          400,
          `Invalid document type: ${firstProcessItem.type}`,
          'INVALID_TYPE',
          sessionId,
        );
      }

      if (!userId) {
        throw this.createError(
          response,
          400,
          `Could not retrieve a valid userId from document ${firstProcessItem.id}.`,
          'NO_USERID_FOUND',
          sessionId,
        );
      }
      console.log(`[${sessionId}] Found userId: ${userId}`);

      const signatureProcess = await this.prisma.signatureProcess.create({
        data: {
          userId: userId,
          status: 'initiated',
          metadata: dto as any,
        },
      });
      console.log(
        `[${sessionId}] Created SignatureProcess record: ${signatureProcess.id}`,
      );

      const documentsToSign: any[] = [];
      const userDetails = {
        name: '',
        fatherLastName: '',
        motherLastName: '',
        email: '',
      };

      for (const item of processtosign) {
        let doc: any;
        let s3Path: string;
        let metadataField: string;
        let prismaModel: any;
        if (item.type === 'will') {
          doc = await this.prisma.testamentHeader.findUniqueOrThrow({
            where: { id: item.id },
            include: { user: true },
          });
          s3Path = `${doc.userId}_${doc.version}.pdf`;
          metadataField = 'metadata';
          prismaModel = this.prisma.testamentHeader;
        } else if (item.type === 'insurance') {
          doc = await this.prisma.userPartnerProductContract.findUniqueOrThrow({
            where: { id: item.id },
            include: { user: true },
          });
          const folder = `${doc.id}/`;
          s3Path = `${folder}${doc.id}.pdf`;
          metadataField = 'signatureMetadata';
          prismaModel = this.prisma.userPartnerProductContract;
        } else {
          throw this.createError(
            response,
            400,
            `Unknown type in processtosign: ${item.type}`,
            'UNKNOWN_TYPE',
            sessionId,
          );
        }

        if (!doc || !doc.user) {
          throw this.createError(
            response,
            404,
            `Document or User not found for ID ${item.id}`,
            'DOC_USER_NOT_FOUND',
            sessionId,
          );
        }
        if (doc.userId !== userId) {
          throw this.createError(
            response,
            400,
            `Document ${item.id} does not belong to user ${userId}`,
            'USER_MISMATCH',
            sessionId,
          );
        }
        if (doc.signatureStatus === 'Signed') {
          throw this.createError(
            response,
            400,
            `Document ${item.id} is already signed.`,
            'ALREADY_SIGNED',
            sessionId,
          );
        }
        const s3File = await this.sharedOperationsService.getFileFromS3(
          this.getBucketWill,
          s3Path,
        );
        if (!s3File) {
          throw this.createError(
            response,
            404,
            `PDF not found for document ${item.id} at ${s3Path}`,
            'S3_NOT_FOUND',
            sessionId,
          );
        }

        await prismaModel.update({
          where: { id: doc.id },
          data: { idSignatureProcess: signatureProcess.id },
        });

        documentsToSign.push({
          ...doc,
          s3Path: s3Path,
          pdfTitle: `${doc.id}.pdf`,
          type: item.type,
          originalId: item.id,
          metadataField: metadataField,
        });

        userDetails.name = doc.user.name;
        userDetails.fatherLastName = doc.user.fatherLastName;
        userDetails.motherLastName = doc.user.motherLastName;
        userDetails.email = doc.user.email;

        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '0',
          {},
          {
            message: `Starting signature process for ${item.type} ${item.id}.`,
          },
          'ok',
          item.type === 'will'
            ? { testamentId: item.id }
            : { contractId: item.id },
        );
      }

      console.log(
        `[${sessionId}] All ${documentsToSign.length} documents validated and linked.`,
      );

      // 2. Flujo Seguridata - Login (Una vez)
      const headers = {
        'Content-Type': 'application/json',
        Authorization: this.signer_authorization,
      };
      const loginBody = {
        org: this.signer_org_string,
        t003c002: this.signer_t003c002,
        t003c004: this.signer_t003c004,
      };
      const url1 = this.signer_base_rest + '/log/in';
      let result = await this.sharedOperationsService.makePostRequest(
        url1,
        loginBody,
        headers,
        true,
      );

      if (result.code != 200 || result.response !== 1) {
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '1',
          loginBody,
          result,
          'failed',
          { signatureProcessId: signatureProcess.id },
        );
        throw this.createError(
          response,
          500,
          'Error logging in to Seguridata.',
          'SEG_LOGIN_FAIL',
          sessionId,
        );
      }
      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '1',
        loginBody,
        result,
        'ok',
        { signatureProcessId: signatureProcess.id },
      );
      console.log(`[${sessionId}] Seguridata login successful.`);

      // 3. Flujo Seguridata - New Process (Una vez)
      const newProcessBody = {
        idcat: this.signer_idcat,
        idsol: this.signer_idsol,
      };
      const url2 = this.signer_base_rest + '/process/new';
      result = await this.sharedOperationsService.makePostRequest(
        url2,
        newProcessBody,
        headers,
        true,
      );

      if (
        result.code != 200 ||
        (typeof result.response === 'string' &&
          result.response.toLowerCase().includes('error'))
      ) {
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '2',
          newProcessBody,
          result,
          'failed',
          { signatureProcessId: signatureProcess.id },
        );
        throw this.createError(
          response,
          500,
          'Error creating Seguridata process.',
          'SEG_NEW_FAIL',
          sessionId,
        );
      }
      const seguridataprocessid = String(result.response);
      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '2',
        newProcessBody,
        result,
        'ok',
        { signatureProcessId: signatureProcess.id },
      );
      console.log(
        `[${sessionId}] Seguridata process created: ${seguridataprocessid}.`,
      );

      // 4. Actualizar nuestro SignatureProcess con el ID de Seguridata
      const currentMetadata = (signatureProcess.metadata as any) || {};
      currentMetadata.seguridataSteps = currentMetadata.seguridataSteps || {};
      currentMetadata.seguridataSteps.login = {
        date: new Date(),
        status: 'ok',
      };
      currentMetadata.seguridataSteps.newProcess = {
        date: new Date(),
        status: 'ok',
        id: seguridataprocessid,
      };

      await this.prisma.signatureProcess.update({
        where: { id: signatureProcess.id },
        data: {
          seguridataprocessid: parseInt(seguridataprocessid, 10),
          status: 'seguridata_created',
          metadata: currentMetadata as any,
        },
      });

      // 5. Flujo Seguridata - Add Files (Múltiples veces)
      const url3 = this.signer_base_rest + '/process/addfiletoprc';
      currentMetadata.seguridataSteps.addFiles = [];

      for (const doc of documentsToSign) {
        console.log(`[${sessionId}] Adding file to Seguridata: ${doc.s3Path}`);
        const formData = [
          { key: 'idprc', value: seguridataprocessid },
          { key: 'idcto', value: this.signer_idsol },
          { key: 'idorg', value: this.signer_org },
        ];

        // ** ¡¡¡PUNTO CRÍTICO!!! **x
        const addFileResult =
          await this.sharedOperationsService.postFileAsFormData(
            url3,
            this.getBucketWill,
            doc.s3Path,
            headers,
            formData,
          );

        const logOptions =
          doc.type === 'will'
            ? { testamentId: doc.originalId }
            : { contractId: doc.originalId };

        if (
          addFileResult.code != 200 ||
          (typeof addFileResult.response == 'string' &&
            addFileResult.response.toLowerCase().includes('error'))
        ) {
          await this.sharedOperationsService.sendSignatureLog(
            sessionId,
            userId,
            new Date(),
            '3',
            formData,
            addFileResult,
            'failed',
            logOptions,
          );
          currentMetadata.seguridataSteps.addFiles.push({
            file: doc.s3Path,
            status: 'failed',
            result: addFileResult,
          });
          await this.prisma.signatureProcess.update({
            where: { id: signatureProcess.id },
            data: { metadata: currentMetadata as any },
          });
          throw this.createError(
            response,
            500,
            `Error adding file ${doc.s3Path} to Seguridata.`,
            'SEG_ADD_FAIL',
            sessionId,
          );
        }
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '3',
          formData,
          addFileResult,
          'ok',
          logOptions,
        );
        currentMetadata.seguridataSteps.addFiles.push({
          file: doc.s3Path,
          status: 'ok',
          result: addFileResult,
        });
        console.log(`[${sessionId}] File ${doc.s3Path} added successfully.`);
      }
      await this.prisma.signatureProcess.update({
        where: { id: signatureProcess.id },
        data: { metadata: currentMetadata as any },
      });

      // 6. Flujo Seguridata - Set Title (Una vez)
      const url4 = this.signer_base_rest + '/process/update';
      const titleBody = {
        idprc: parseInt(seguridataprocessid, 10),
        fld: 'p8',
        data: `${signatureProcess.id}_batch.pdf`,
        tipo: 0,
      };
      result = await this.sharedOperationsService.makePostRequest(
        url4,
        titleBody,
        headers,
        true,
      );

      if (result.code != 200) {
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '4',
          titleBody,
          result,
          'failed',
          { signatureProcessId: signatureProcess.id },
        );
        throw this.createError(
          response,
          500,
          'Error setting title in Seguridata.',
          'SEG_TITLE_FAIL',
          sessionId,
        );
      }
      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '4',
        titleBody,
        result,
        'ok',
        { signatureProcessId: signatureProcess.id },
      );
      currentMetadata.seguridataSteps.setTitle = {
        date: new Date(),
        status: 'ok',
      };
      await this.prisma.signatureProcess.update({
        where: { id: signatureProcess.id },
        data: { metadata: currentMetadata as any },
      });
      console.log(`[${sessionId}] Seguridata title set.`);

      // 7. Flujo Seguridata - Set Signers (Una vez)
      const signersBody = {
        idprc: parseInt(seguridataprocessid, 10),
        fld: 'p33',
        data: 1,
        tipo: 0,
      }; // Asumimos 1 firmante
      result = await this.sharedOperationsService.makePostRequest(
        url4,
        signersBody,
        headers,
        true,
      ); // Reusa url4

      if (result.code != 200) {
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '5',
          signersBody,
          result,
          'failed',
          { signatureProcessId: signatureProcess.id },
        );
        throw this.createError(
          response,
          500,
          'Error setting signers in Seguridata.',
          'SEG_SIGNERS_FAIL',
          sessionId,
        );
      }
      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '5',
        signersBody,
        result,
        'ok',
        { signatureProcessId: signatureProcess.id },
      );
      currentMetadata.seguridataSteps.setSigners = {
        date: new Date(),
        status: 'ok',
      };
      await this.prisma.signatureProcess.update({
        where: { id: signatureProcess.id },
        data: { metadata: currentMetadata as any },
      });
      console.log(`[${sessionId}] Seguridata signers set.`);

      // 8. Flujo Seguridata - Get Token (Una vez)
      const url6 = this.signer_base_rest + '/process/addtkzphtrltr';
      const tokenBody = {
        idprc: parseInt(seguridataprocessid, 10),
        nombre: [
          userDetails.name,
          userDetails.fatherLastName,
          userDetails.motherLastName,
        ]
          .filter(Boolean)
          .join(' '),
        email: userDetails.email,
        tipo: String(this.signer_tipo),
        perfil: String(this.signer_perfil),
        org: String(this.signer_org),
        firma: String(this.signer_flujofirma),
      };
      result = await this.sharedOperationsService.makePostRequest(
        url6,
        tokenBody,
        headers,
        true,
      );

      if (
        result.code != 200 ||
        typeof result.response !== 'string' ||
        result.response.toLowerCase().includes('error')
      ) {
        await this.sharedOperationsService.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '6',
          tokenBody,
          result,
          'failed',
          { signatureProcessId: signatureProcess.id },
        );
        throw this.createError(
          response,
          500,
          'Error getting token from Seguridata.',
          'SEG_TOKEN_FAIL',
          sessionId,
        );
      }

      const token = result.response;
      const signingUrl = `${this.signer_base}/Extr.hd?task=access&hd=${this.signer_hd}&idorg=${this.signer_org}&org=${this.signer_org}&idprc=${seguridataprocessid}&token=${token}&idp=6177`;

      await this.sharedOperationsService.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '6',
        tokenBody,
        { ...result, urlcalculated: signingUrl },
        'ok',
        { signatureProcessId: signatureProcess.id },
      );
      currentMetadata.seguridataSteps.getToken = {
        date: new Date(),
        status: 'ok',
        url: signingUrl,
      };
      await this.prisma.signatureProcess.update({
        where: { id: signatureProcess.id },
        data: { status: 'waiting_signature', metadata: currentMetadata as any },
      });
      console.log(
        `[${sessionId}] Seguridata token received, URL generated: ${signingUrl}.`,
      );

      response.code = 200;
      response.msg = `Success - SessionId-> ${sessionId}`;
      response.response = {
        url: signingUrl,
        signatureProcessId: signatureProcess.id,
      };
      console.log(
        `[${sessionId}] Process finished successfully. Sending response.`,
      );

      return response;
    } catch (error) {
      console.error('Error in signPdf-> noxc7', error);
      processException(error);
    }
  }
}
