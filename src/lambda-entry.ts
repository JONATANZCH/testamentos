import { configure as serverlessExpress } from '@codegenie/serverless-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

let cachedServer;

export const handler = async (event, context) => {
  if (!cachedServer) {
    const nestApp = await NestFactory.create(AppModule);

    // 🔹 Aplica el ValidationPipe aquí
    nestApp.useGlobalPipes(
      new ValidationPipe({
        transform: true, // Habilitar la transformación automática de tipos
        whitelist: true, // Remover campos extra
        forbidNonWhitelisted: true, // Lanzar error si hay campos extra
      }),
    );

    // 🔹 Habilitar CORS en NestJS
    nestApp.enableCors({
      origin: '*', // Permitir cualquier origen (ajusta según necesidad)
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Authorization'],
      credentials: true, // Habilita credenciales (aunque Cognito usa tokens en Headers)
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
    if (event.requestContext) {
      console.log('Request context:', event.requestContext);
      console.log('Authorizer:', event.requestContext?.authorizer);
      console.log('JWT token:', event.requestContext?.authorizer?.jwt);
    }
  }

  const response = await cachedServer(event, context);

  // 🔹 Detectar si es una respuesta en Base64 y forzar `isBase64Encoded: true`
  if (
    response.headers?.['Content-Type'] === 'application/pdf' &&
    typeof response.body === 'string'
  ) {
    response.isBase64Encoded = true;
  }

  console.log('Processed event:', event);
  console.log('Response:', response);
  return response;
};
