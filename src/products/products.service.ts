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

      // const alreadyExists =
      //   await this.prisma.userPartnerProductContract.findFirst({
      //     where: { userId, serviceId: dto.serviceId },
      //   });

      // if (alreadyExists) {
      //   throw new HttpException(
      //     'Subscription already exists',
      //     HttpStatus.CONFLICT,
      //   );
      // }

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
          status: 'created',
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
      const folder = `Parner-product${contract.id}/`;
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
}
