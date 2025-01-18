import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';
import 'reflect-metadata';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {
    const stage = this.configService.get<string>('NODE_ENV') || 'dev';

    const basePath = `${stage}/testamentos`;

    Reflect.defineMetadata('path', basePath, AppController);
  }

  @Get()
  getAll(): string {
    return 'Hola desde /testamentos';
  }

  @Get(':path')
  getHello(@Param('path') path: string): string {
    return this.appService.getHello() + `, path param = ${path}`;
  }
}
