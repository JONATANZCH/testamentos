import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('testamentos')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getAll(): string {
    return 'Hola desde /testamentos';
  }

  @Get(':path')
  getHello(@Param('path') path: string): string {
    return this.appService.getHello() + `, path param = ${path}`;
  }
}
