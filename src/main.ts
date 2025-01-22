import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  // When we have data and they have decorators then they are automatically validated
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove the extra fields
      forbidNonWhitelisted: true, // throw an error if there are extra fields
    }),
  );
  const port = configService.getPort();
  await app.listen(port);
  console.log(`Application is running on port: ${port}`);
}
bootstrap();
