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
      PORT: Joi.number(),
      AWSREGION: Joi.string().required(),
      AWS_SECRET_ID: Joi.string().required(),
      QUEUE_PROCESS_PDF: Joi.string().required(),
      PPERRORMANAGEMENT: Joi.string().required(),
      GETSNSTOPICARN: Joi.string().required(),
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

  getQueueProcessPdf(): string {
    return this.get('QUEUE_PROCESS_PDF');
  }

  getPpErrorManagement(): string {
    return this.get('PPERRORMANAGEMENT');
  }

  getSnsTopicArn(): string {
    return this.get('GETSNSTOPICARN');
  }
}
