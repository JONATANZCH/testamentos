import { Injectable } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { ConfigService } from './config.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SqsService {
  private readonly sqsClient: SQSClient;

  constructor(private readonly configService: ConfigService) {
    this.sqsClient = new SQSClient({
      region: this.configService.getAwsRegion(),
    });
  }

  async sendMessage(queueUrl: string, messageBody: any): Promise<void> {
    const params = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
      MessageGroupId: 'testament_group',
      MessageDeduplicationId: uuidv4(),
    };

    const command = new SendMessageCommand(params);
    const result = await this.sqsClient.send(command);
    console.log('SQS send result:', result);
  }
}
