import { Injectable } from '@nestjs/common';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { ConfigService } from '../config/config.service';
import { processException } from '../common/utils/exception.helper';

export interface PPLogPayload {
  microsvc: string;
  process: string;
  message: string;
  code?: string;
  Idrelated?: string;
  level?: 'error' | 'warning' | 'info';
  metadata?: any;
}

@Injectable()
export class PPErrorManagementService {
  private readonly lambdaClient: LambdaClient;
  readonly snsClient: SNSClient;

  private readonly getPpErrorManagement: string;
  readonly snsTopicArn: string;

  constructor(private readonly configService: ConfigService) {
    this.lambdaClient = new LambdaClient({
      region: this.configService.getAwsRegion(),
    });
    this.snsClient = new SNSClient({
      region: this.configService.getAwsRegion(),
    });
    this.getPpErrorManagement = this.configService.getPpErrorManagement();
    this.snsTopicArn = this.configService.getSnsTopicArn();
  }

  async sendLog(payload: PPLogPayload): Promise<any> {
    console.log('payload: ', payload);

    const command = new InvokeCommand({
      FunctionName: this.getPpErrorManagement,
      Payload: Buffer.from(JSON.stringify(payload)),
      InvocationType: 'RequestResponse',
    });

    const maxAttempts = 3;
    const delayMs = 1000;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        console.log(
          `[PPErrorManagement] Attempt ${attempts + 1} to invoke Lambda`,
        );
        const response = await this.lambdaClient.send(command);

        if (payload.level === 'error') {
          console.log(
            '[PPErrorManagementService] Publicando mensaje a SNS (error level).',
          );

          const publishCmd = new PublishCommand({
            TopicArn: this.snsTopicArn,
            Subject: `Error in microservice: ${payload.microsvc}`,
            Message:
              `An error occurred in process "${payload.process}":\n${payload.message}\n\n` +
              `Code: ${payload.code || 'N/A'}\nID Related: ${payload.Idrelated || 'N/A'}\n`,
            MessageGroupId: 'PPErrorManagementGroup',
            MessageDeduplicationId: new Date().getTime().toString(),
          });

          try {
            const snsResponse = await this.snsClient.send(publishCmd);
            console.log(
              '[PPErrorManagementService] SNS published successfully:',
              snsResponse,
            );
          } catch (snsErr) {
            console.error(
              '[PPErrorManagementService] Error publicando en SNS:',
              snsErr,
            );
          }
        }

        return response;
      } catch (err: any) {
        const isColdStart =
          err?.name === 'CodeArtifactUserPendingException' ||
          err?.message?.includes('Lambda is initializing');

        if (isColdStart && attempts < maxAttempts - 1) {
          console.warn(
            `[PPErrorManagement] Lambda warming up (attempt ${attempts + 1}), retrying in ${delayMs}ms...`,
          );
          await new Promise((res) => setTimeout(res, delayMs));
          attempts++;
        } else {
          console.error('Error al invocar PPErrorManagement lambda:', err);
          processException(err);
          break;
        }
      }
    }
  }
}
