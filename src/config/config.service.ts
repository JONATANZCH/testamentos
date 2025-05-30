import { Injectable } from '@nestjs/common';
import * as Joi from 'joi';
import { EnvConfig } from './vars.interface';

@Injectable()
export class ConfigService {
  private readonly envConfig: EnvConfig;

  constructor() {
    this.envConfig = this.validateEnvVariables(process.env);
  }

  private validateEnvVariables(envVariables: NodeJS.ProcessEnv): EnvConfig {
    const schema = Joi.object<EnvConfig>({
      environment: Joi.string().valid('dev', 'prod', 'qa'),
      PORT: Joi.number().default(3000),
      AWSREGION: Joi.string().required(),
      AWS_SECRET_ID: Joi.string().required(),
      QUEUE_WILLS_COMMUNICATIONS: Joi.string().required(),
      PPERRORMANAGEMENT: Joi.string().required(),
      GETSNSTOPICARN: Joi.string().required(),
      SQSCOMM_NOWAIT_QUEUE: Joi.string().required(),
      EMAIL_FROM: Joi.string().required(),
      SG_SEND_WILLS: Joi.string().required(),
      BUCKET_WILL: Joi.string().required(),
      SG_SEND_WELCOME: Joi.string().required(),
      MINT_API_URL: Joi.string().required(),
    });

    const { error, value } = schema.validate(envVariables, {
      abortEarly: false,
      allowUnknown: true,
    });

    if (error) {
      throw new Error(`Config validation error: ${error.message}`);
    }

    return value;
  }

  /**
   * Obtiene una variable de entorno por clave.
   * @param key Clave de la variable
   * @returns Valor de la variable
   */
  get<T extends keyof EnvConfig>(key: T): EnvConfig[T] {
    const value = this.envConfig[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
  }

  getNodeEnv(): string {
    return this.get('environment');
  }

  getPort(): number {
    return this.get('PORT');
  }

  getAwsRegion(): string {
    return this.get('AWSREGION');
  }

  getAwsSecretId(): string {
    return this.get('AWS_SECRET_ID');
  }

  getQueueWillsCommunications(): string {
    return this.get('QUEUE_WILLS_COMMUNICATIONS');
  }

  getPpErrorManagement(): string {
    return this.get('PPERRORMANAGEMENT');
  }

  getSnsTopicArn(): string {
    return this.get('GETSNSTOPICARN');
  }

  getSqsCommNoWaitQueue(): string {
    return this.get('SQSCOMM_NOWAIT_QUEUE');
  }

  getEmailFrom(): string {
    return this.get('EMAIL_FROM');
  }

  getSgSendWills(): string {
    return this.get('SG_SEND_WILLS');
  }

  getBucketWill(): string {
    return this.get('BUCKET_WILL');
  }

  getSgSendWelcome(): string {
    return this.get('SG_SEND_WELCOME');
  }

  getMintApiUrl(): string {
    return this.get('MINT_API_URL');
  }
}
