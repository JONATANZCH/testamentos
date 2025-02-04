import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  // CORS
  app.enableCors({
    origin: '*', // Permitir todas las orígenes (ajústalo según tu necesidad)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', // Métodos HTTP permitidos
    allowedHeaders: 'Content-Type, Accept, Authorization', // Headers permitidos
  });
  // When we have data and they have decorators then they are automatically validated
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Habilitar la transformación automática de tipos
      whitelist: true, // remove the extra fields
      forbidNonWhitelisted: true, // throw an error if there are extra fields@
    }),
  );
  const port = configService.getPort();
  await app.listen(port);
  console.log(`Application is running on port: ${port}`);
}
bootstrap();
