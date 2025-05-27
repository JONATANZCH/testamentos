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
import {
  ProcessToSignItemDto,
  SignProcessType,
} from '../common/dto/create-sign-pdf.dto';

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
    processtosignList: ProcessToSignItemDto[],
    userId: string,
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
          processtosignList,
          userId,
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
    _batchKeyFileBase: string,
    processtosignList: ProcessToSignItemDto[],
    userId: string,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    const filesUploadedToS3: {
      originalZipPath: string;
      finalS3Key: string;
      docId: string;
      type: SignProcessType;
    }[] = [];
    let allExpectedDocsHaveTheirFiles = true; // Para verificar que cada doc del lote tenga sus archivos

    console.log(
      `[SharedOps/handleZipFile] Processing ZIP for user ${userId}, batch ref: ${_batchKeyFileBase}. Expecting docs for:`,
      processtosignList.map((p) => p.id),
    );

    try {
      const directory = await unzipper.Open.buffer(zipBuffer);
      console.log(
        `[SharedOps/handleZipFile] Files found in ZIP: ${directory.files.length}.`,
      );

      // 1. Obtener versiones para todos los testamentos en el lote de una vez
      const testamentVersions = new Map<string, number>();
      const willIdsInProcess = processtosignList
        .filter((p) => p.type === SignProcessType.WILL)
        .map((p) => p.id);

      if (willIdsInProcess.length > 0) {
        const testaments = await this.prisma.testamentHeader.findMany({
          where: { id: { in: willIdsInProcess }, userId: userId },
          select: { id: true, version: true },
        });
        testaments.forEach((t) => testamentVersions.set(t.id, t.version));
      }

      // 2. Procesar cada archivo del ZIP
      for (const fileInZip of directory.files) {
        const originalZipPath = fileInZip.path;
        console.log(
          `[SharedOps/handleZipFile] Processing file from ZIP: ${originalZipPath}`,
        );

        const fileContent = await fileInZip.buffer();
        if (fileContent.slice(0, 4).toString() !== '%PDF') {
          console.log(
            `[SharedOps/handleZipFile] File ${originalZipPath} is not a PDF, skipping.`,
          );
          continue;
        }

        let associatedDocItem: ProcessToSignItemDto | undefined = undefined;
        for (const docItem of processtosignList) {
          if (
            originalZipPath.toLowerCase().includes(docItem.id.toLowerCase())
          ) {
            associatedDocItem = docItem;
            break;
          }
        }

        if (!associatedDocItem) {
          console.warn(
            `[SharedOps/handleZipFile] Could not associate ZIP file ${originalZipPath} with any document in processtosignList. Skipping.`,
          );
          allExpectedDocsHaveTheirFiles = false;
          continue;
        }

        let finalS3Key: string;
        let fileTypeSuffix: string;

        // Determinar el sufijo basado en el contenido del nombre del archivo en el ZIP
        if (originalZipPath.toUpperCase().includes('RGCCNOM151')) {
          fileTypeSuffix =
            associatedDocItem.type === SignProcessType.WILL
              ? '_RGCCNOM151.pdf'
              : '_INSURANCE_RGCCNOM151.pdf';
        } else {
          // Si no es RGCCNOM151 y es PDF, asumimos que es el "PASTPOST" o equivalente
          fileTypeSuffix =
            associatedDocItem.type === SignProcessType.WILL
              ? '_PASTPOST.pdf'
              : '_INSURANCE_PASTPOST.pdf';
        }

        if (associatedDocItem.type === SignProcessType.WILL) {
          const version = testamentVersions.get(associatedDocItem.id);
          if (!version) {
            console.error(
              `[SharedOps/handleZipFile] No version found for will ${associatedDocItem.id}. Cannot save file ${originalZipPath}.`,
            );
            allExpectedDocsHaveTheirFiles = false;
            continue;
          }
          finalS3Key = `${userId}/${associatedDocItem.id}_${version}${fileTypeSuffix}`;
        } else {
          // INSURANCE
          finalS3Key = `${userId}/${associatedDocItem.id}${fileTypeSuffix}`;
        }

        try {
          console.log(
            `[SharedOps/handleZipFile] Saving extracted file ${originalZipPath} to S3 as ${finalS3Key}`,
          );
          await this.PostFileToS3(bucketName, finalS3Key, fileContent);
          filesUploadedToS3.push({
            originalZipPath,
            finalS3Key,
            docId: associatedDocItem.id,
            type: associatedDocItem.type,
          });
        } catch (s3Error) {
          console.error(
            `[SharedOps/handleZipFile] Failed to upload ${finalS3Key} to S3 for original ${originalZipPath}:`,
            s3Error,
          );
          allExpectedDocsHaveTheirFiles = false;
        }
      }

      for (const docItem of processtosignList) {
        const filesForThisDoc = filesUploadedToS3.filter(
          (f) => f.docId === docItem.id,
        );
        if (filesForThisDoc.length < 2) {
          console.warn(
            `[SharedOps/handleZipFile] Document ${docItem.id} (type: ${docItem.type}) has only ${filesForThisDoc.length} files processed, expected 2.`,
          );
          allExpectedDocsHaveTheirFiles = false;
        }
      }

      if (!allExpectedDocsHaveTheirFiles) {
        console.log(
          `[SharedOps/handleZipFile] Not all expected PDF files were successfully processed and uploaded from batch ${_batchKeyFileBase}. Check warnings above.`,
        );
        response.code = 500;
        response.msg =
          'Failed to process and upload all required PDF files from ZIP.';
        response.response = {
          uploadedFiles: filesUploadedToS3,
          details: 'Some files may be missing or failed to upload.',
        };
        return response;
      }

      console.log(
        `[SharedOps/handleZipFile] All ${filesUploadedToS3.length} PDF files extracted from ZIP and saved to S3 successfully for batch ${_batchKeyFileBase}`,
      );
      response.code = 200;
      response.msg = 'Files extracted and uploaded to S3 successfully';
      response.response = { uploadedFiles: filesUploadedToS3 };
      return response;
    } catch (error) {
      console.log(
        `[SharedOps/handleZipFile] Pastpost Error-> 2asuidj20xks8 for batch ${_batchKeyFileBase}:`,
        error,
      );
      response.code = 500;
      response.msg = error.message || 'Error unzipping and saving files to S3';
      response.response = { originalError: error.message };
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

  async getNomSignedPdf(
    keyFile: string,
    seguridataprocessId: string,
    processtosignList?: ProcessToSignItemDto[],
    userId?: string,
  ) {
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
        processtosignList,
        userId,
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
      signatureProcessId?: string;
    },
  ) {
    try {
      this.prisma = await this.prismaprovider.getPrismaClient();
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
          signatureProcessId: options?.signatureProcessId ?? null,
        },
      });
      return true;
    } catch (error) {
      console.log('Wills/Contract Error-> sdf2 / Logging Error');
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

  async downloadSeguridataContract(
    signatureProcess: any,
    processtosignList: any[],
    sessionId: string,
    numericSeguridataId: number,
  ): Promise<GeneralResponseDto> {
    const response = new GeneralResponseDto();
    console.log(
      `[${sessionId}] downloadSeguridataContract for SP_ID ${signatureProcess.id}, Seguridata ID ${numericSeguridataId}`,
    );

    if (!signatureProcess.user || !signatureProcess.userId) {
      console.log(
        `[${sessionId}] User information missing in SignatureProcess for S3 paths (SP_ID ${signatureProcess.id}).`,
      );
      response.code = 500;
      response.msg = 'User information missing in SignatureProcess.';
      return response;
    }
    const userId = signatureProcess.userId;

    try {
      let allFinalFilesExist = true;
      const expectedFinalS3Keys: {
        docId: string;
        type: SignProcessType;
        keys: string[];
      }[] = [];

      for (const docItem of processtosignList) {
        const currentDocKeys: string[] = [];
        if (docItem.type === SignProcessType.WILL) {
          const testament = await this.prisma.testamentHeader.findUnique({
            where: { id: docItem.id, userId: userId },
            select: { version: true },
          });
          if (!testament) {
            console.log(
              `[${sessionId}] TestamentHeader not found for ID ${docItem.id} to get version. Cannot check S3.`,
            );
            allFinalFilesExist = false;
            break;
          }
          const version = testament.version;
          currentDocKeys.push(`${userId}/${userId}_${version}_RGCCNOM151.pdf`);
          currentDocKeys.push(`${userId}/${userId}_${version}_PASTPOST.pdf`);
        } else if (docItem.type === SignProcessType.INSURANCE) {
          currentDocKeys.push(
            `${userId}/${docItem.id}_INSURANCE_RGCCNOM151.pdf`,
          );
          currentDocKeys.push(`${userId}/${docItem.id}_INSURANCE_PASTPOST.pdf`);
        }

        if (currentDocKeys.length === 0 && processtosignList.length > 0) {
          console.log(
            `[${sessionId}] Could not determine S3 keys for docItem:`,
            docItem,
          );
          allFinalFilesExist = false;
          break;
        }

        if (currentDocKeys.length > 0) {
          expectedFinalS3Keys.push({
            docId: docItem.id,
            type: docItem.type,
            keys: currentDocKeys,
          });

          for (const key of currentDocKeys) {
            if (!(await this.valididatifFileinS3(this.getBucketWill, key))) {
              console.log(
                `[${sessionId}] Expected signed file ${key} for doc ${docItem.id} (type ${docItem.type}) not found in S3.`,
              );
              allFinalFilesExist = false;
              break;
            }
          }
        }

        if (!allFinalFilesExist) {
          break;
        }
      }

      if (allFinalFilesExist && processtosignList.length > 0) {
        response.code = 200;
        response.msg = 'All expected signed documents already exist in S3.';
        console.log(
          `[${sessionId}] All signed PDFs for SP_ID ${signatureProcess.id} (Seguridata ID ${numericSeguridataId}) exist in S3. Skipping download.`,
        );

        await this.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '102',
          { message: 'All signed files for the batch already exist in S3.' },
          { checkedKeys: expectedFinalS3Keys.flatMap((e) => e.keys) },
          'ok',
          { signatureProcessId: signatureProcess.id },
        );
        return response;
      }

      if (processtosignList.length === 0) {
        console.log(
          `[${sessionId}] No documents in processtosignList for SP_ID ${signatureProcess.id}. Cannot proceed with download.`,
        );
        response.code = 400;
        response.msg = 'No documents specified for signature process.';
        return response;
      }

      console.log(
        `[${sessionId}] Not all signed files found in S3 for SP_ID ${signatureProcess.id}. Proceeding to download from Seguridata.`,
      );

      const batchKeyFileBase = `${userId}/${signatureProcess.id}_SIGNED_FILES_BATCH`;

      console.log(
        `[${sessionId}] Calling getNomSignedPdf for SP_ID ${signatureProcess.id} with batchKeyFileBase: ${batchKeyFileBase}`,
      );

      const nomResponse = await this.getNomSignedPdf(
        batchKeyFileBase,
        String(numericSeguridataId),
        processtosignList,
        userId,
      );

      console.log(
        `[${sessionId}] Response from getNomSignedPdf for SP_ID ${signatureProcess.id}:`,
        nomResponse,
      );

      if (nomResponse.code !== 200) {
        console.log(
          `[${sessionId}] Error response from getNomSignedPdf for SP_ID ${signatureProcess.id}: ` +
            JSON.stringify(nomResponse),
        );
        await this.sendSignatureLog(
          sessionId,
          userId,
          new Date(),
          '102',
          {
            action: 'getNomSignedPdf',
            batchKeyFileBase: batchKeyFileBase,
            seguridataProcessId: numericSeguridataId,
          },
          { response: nomResponse },
          'failed',
          { signatureProcessId: signatureProcess.id },
        );
        throw new HttpException(
          nomResponse,
          nomResponse.code || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      console.log(
        `[${sessionId}] getNomSignedPdf and implicit handleZipFile successful for SP_ID ${signatureProcess.id}.`,
      );
      await this.sendSignatureLog(
        sessionId,
        userId,
        new Date(),
        '102',
        {
          action: 'getNomSignedPdf_and_handleZipFile_implicit',
          batchKeyFileBase: batchKeyFileBase,
        },
        { response: nomResponse },
        'ok',
        { signatureProcessId: signatureProcess.id },
      );
      return nomResponse;
    } catch (error) {
      console.log('Pastpost Error-> 3asd212');
      processException(error);
    }
  }
}
