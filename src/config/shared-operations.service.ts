import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { PrismaProvider } from '../providers';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import * as qs from 'qs';
import { ConfigService } from '../config';
import { processException } from '../common/utils/exception.helper';
import * as unzipper from 'unzipper';
import { GeneralResponseDto } from '../common/response.dto'; // Adjust path as needed
import { Readable } from 'stream';

@Injectable()
export class SharedOperationsService {
  private prisma: any = null;
  private readonly environment: string;
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
    private readonly httpService: HttpService,
    private readonly nestConfigService: NestConfigService,
    private readonly configService: ConfigService,
    private readonly prismaprovider: PrismaProvider,
  ) {
    this.environment = this.configService.getNodeEnv();
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
      console.error(
        '[SharedOpsService] Error making POST request to ' + url + ':',
        error.message,
      );
      responseg.code = error.response?.status || 500;
      responseg.msg = 'Error making POST request';
      responseg.response = error.response?.data || error.message;
      return responseg;
    }
  }

  async PostToGetFileAsFormData(
    url: string,
    bucketName: string,
    headers: any,
    seguridataprocessId: string,
    keyFile: string, // Base key for S3 (e.g., userId_version)
  ): Promise<GeneralResponseDto> {
    const responseg = new GeneralResponseDto();
    try {
      const body = new URLSearchParams();
      body.append('idprc', seguridataprocessId);

      const axiosResponse = await firstValueFrom(
        this.httpService.post(url, body.toString(), {
          headers,
          responseType: 'arraybuffer',
        }),
      );

      if (axiosResponse.status === 200) {
        const zipBuffer = Buffer.from(axiosResponse.data);
        console.log(
          `[SharedOpsService] ZIP file received from provider for ${keyFile}, size: ${zipBuffer.length} bytes`,
        );

        // Save the original ZIP to S3
        await this.PostFileToS3(bucketName, `${keyFile}.zip`, zipBuffer);
        console.log(
          `[SharedOpsService] Original ZIP file saved to S3: ${keyFile}`,
        );

        // Process the ZIP (extract and save contents)
        const handleZipFileResp = await this.handleZipFile(
          zipBuffer,
          bucketName,
          keyFile,
        );

        if (handleZipFileResp.code !== 200) {
          console.error(
            '[SharedOpsService] Error handling ZIP file:',
            handleZipFileResp.msg,
          );
          responseg.code = 500;
          responseg.msg = 'Error handling ZIP file';
          responseg.response = handleZipFileResp;
          throw new HttpException(
            handleZipFileResp,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        responseg.code = 200;
        responseg.msg =
          'ZIP file received, processed, and contents uploaded to S3.';
      } else {
        responseg.code = axiosResponse.status || 500;
        responseg.msg = 'Error getting file as form-data from provider.';
      }
      responseg.response = axiosResponse.data;
      return responseg;
    } catch (error) {
      console.log('Pastpost Error-> ccnsu9hsfp');
      let errorMessage = 'Unknown error';
      if (error.response?.data) {
        const zipBuffer = Buffer.from(error.response.data);
        errorMessage = zipBuffer.toString('utf-8');
      } else if (typeof error.message === 'string') {
        errorMessage = error.message;
      }

      console.error('Error getting pdf from NOM Provider', errorMessage);
      responseg.code = error.response?.status ?? 500;
      responseg.msg = errorMessage;
      responseg.response = {};
      return responseg;
    }
  }

  async PostFileToS3(
    bucketName: string,
    key: string,
    buffer: Buffer,
  ): Promise<string> {
    try {
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
      });
      await this.s3Client.send(putCommand);
      console.log(
        `[SharedOpsService] File ${key} posted to S3 bucket ${bucketName}`,
      );
      return 'ok';
    } catch (error) {
      console.error(
        `[SharedOpsService] Error posting file ${key} to S3 bucket ${bucketName}:`,
        error,
      );
      throw error;
    }
  }

  async handleZipFile(
    zipBuffer: Buffer,
    bucketName: string,
    keyFile: string,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    try {
      // Descomprimir el archivo zip
      const directory = await unzipper.Open.buffer(zipBuffer);
      console.log(`Files found in ZIP: ${directory.files.length}`);

      let files = '';
      const filesuploaded: string[] = [];
      let pdfCount = 0;

      if (directory.files.length !== 3) {
        for (const file of directory.files) {
          files += file.path + '\n';
        }

        const errormsg = `Error in seguridata in ENVIRONMENT ${this.environment}
    Handlezipfile: Files extracted from ZIP are not 3 
    for will id: ${keyFile}
    Files found in ZIP: ${files}`;

        console.log('SNS message sent' + errormsg);
        // await this.sendSnsMessage(errormsg, this.topicArnEnv);
      }

      for (let i = 0; i < directory.files.length; i++) {
        const file = directory.files[i];
        const fileContent = await file.buffer();
        const isPdf = fileContent.slice(0, 4).toString() === '%PDF';

        console.log(
          `File ${file.path} found in ZIP size ${fileContent.length} bytes`,
        );

        if (!isPdf) {
          console.log(`Archivo ${file.path} no es un PDF real, no se subirá`);
          continue;
        }

        const filename =
          pdfCount === 0
            ? `${keyFile}_RGCCNOM151.pdf`
            : `${keyFile}_PASTPOST.pdf`;
        const s3Key = `${keyFile}/${filename}`;
        try {
          console.log(`Guardando archivo ${s3Key} en S3`);
          await this.PostFileToS3(bucketName, s3Key, fileContent);
          console.log(`File ${s3Key} uploaded to S3 successfully`);
          filesuploaded.push(s3Key);
          pdfCount++;
        } catch (error) {
          console.log(
            `File ${s3Key} failed to be uploaded to S3 with error:`,
            error,
          );
        }
      }
      if (pdfCount < 2) {
        response.code = 500;
        response.msg = 'Not all required PDF files were found and uploaded';
        response.response = filesuploaded;
        return response;
      }

      console.log(
        `Archivos del ZIP guardados en S3 bajo la carpeta ${keyFile}`,
      );
      response.code = 200;
      response.msg = 'Files extracted and uploaded to S3 successfully';
      response.response = keyFile;
      return response;
    } catch (error) {
      console.log('Pastpost Error-> 2asuidj20xks8');
      console.error('Error unzipping and saving files to S3:', error);
      response.code = 500;
      response.msg = 'Error extracting and uploading files to S3';
      response.response = error.message || error;
      return response;
    }
  }

  async valididatifFileinS3(bucketName: string, key: string): Promise<boolean> {
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    try {
      await this.s3Client.send(headCommand);
      console.log(
        `[SharedOpsService] File ${key} exists in S3 bucket ${bucketName}.`,
      );
      return true;
    } catch (headError) {
      if (headError.name === 'NotFound') {
        console.log(
          `[SharedOpsService] File ${key} not found in S3 bucket ${bucketName}.`,
        );
        return false;
      }
      console.error(
        `[SharedOpsService] Error checking S3 file ${key} in bucket ${bucketName}:`,
        headError,
      );
      throw headError;
    }
  }

  public async getFileFromS3(bucketName: string, key: string): Promise<Buffer> {
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

  async getNomSignedPdf(keyFile: string, seguridataprocessId: string) {
    let response = new GeneralResponseDto();
    try {
      console.log('Getting NOM signed pdf');
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
      const result = await this.makePostRequest(url1, body, headers, true);
      if (
        result.code != 200 ||
        result.response !== 1 ||
        (typeof result.response == 'string' &&
          result.response.toLowerCase().includes('error'))
      ) {
        console.log('result ->' + result.response);
        console.log('error loging to seguridata');
        response.code = 500;
        response.msg = 'Error loging to seguridata';
        return response;
      }

      const headers2 = {
        Authorization: this.signer_authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      const url3 = this.signer_base_rest + '/process/getprcfiles';
      //228447
      response = await this.PostToGetFileAsFormData(
        url3,
        this.getBucketWill,
        headers2,
        seguridataprocessId,
        keyFile,
      );
      return response;
    } catch (error) {
      console.log('Pastpost Error-> nb83h3s');
      processException(error);
    }
  }

  public async sendSignatureLog(
    sessionId: string,
    userId: string,
    date: Date,
    step: string,
    sendMetadata: any,
    responseMetadata: any,
    status: string,
    options?: {
      testamentId?: string;
      contractId?: string;
    },
  ) {
    try {
      const s = status.toLowerCase();
      if (s !== 'ok') {
        try {
          const errormsg =
            `Error in seguridata in ENVIRONMENT ${this.environment}\n` +
            `Process for testament: ${options?.testamentId ?? 'N/A'}\n` +
            `Process for contract: ${options?.contractId ?? 'N/A'}\n` +
            `- step: ${step}\n- status: ${status}\n- sessionId: ${sessionId}\n` +
            `- userId: ${userId}\n- date: ${date}\n- sendMetadata: ${JSON.stringify(
              sendMetadata,
            )}\n- responseMetadata: ${JSON.stringify(responseMetadata)}`;

          // Optionally send SNS here
          console.log('SNS message sent', errormsg);
        } catch (error) {
          console.log('Error sending SNS message:', error);
        }
      }
      this.prisma = await this.prismaprovider.getPrismaClient();
      await this.prisma.signatureStatus.create({
        data: {
          signSession: sessionId,
          userId,
          date,
          step,
          sendMetadata,
          responseMetadata,
          status,
          testamentId: options?.testamentId ?? null,
          contractId: options?.contractId ?? null,
        },
      });
      return true;
    } catch (error) {
      console.log('wills Error-> sdf2');
      console.log('Error creating Log of Signature', error);
      return false;
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
