import { configure as serverlessExpress } from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

let cachedServer;

export const handler = async (event, context) => {
  if (!cachedServer) {
    const nestApp = await NestFactory.create(AppModule);
    await nestApp.init();
    cachedServer = serverlessExpress({
      app: nestApp.getHttpAdapter().getInstance(),
    });
  }
  console.log('Handler called');
  console.log('Original event:', event);

  if (event.Records) {
    console.log('Request comes from SQS queue');
    try {
      event = JSON.parse(event.Records[0].body);
    } catch (error) {
      console.log('Error parsing SQS body');
      console.log('Error:', error);
      event = event.Records[0];
    }
  } else {
    console.log('Request comes from API Gateway');
  }
  console.log('Processed event:', event);
  return cachedServer(event, context);
};
