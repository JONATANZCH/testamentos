import { configure as serverlessExpress } from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

let cachedServer;

export const handler = async (event, context) => {
  if (!cachedServer) {
    const nestApp = await NestFactory.create(AppModule);

    // 🔹 Habilitar CORS en NestJS
    nestApp.enableCors({
      origin: '*', // Permitir cualquier origen (ajusta según necesidad)
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

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

    // 🔹 Responder manualmente con CORS para API Gateway
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: '',
      };
    }
  }

  console.log('Processed event:', event);
  return cachedServer(event, context);
};
