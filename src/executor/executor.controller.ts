import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Put,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ExecutorService } from './executor.service';
import { CreateExecutorDto, UpdateExecutorDto } from './dto';
import { ConfigService } from '../config';
import { GeneralResponseDto } from '../common';

@Controller('wills/executors')
export class ExecutorController {
  private readonly environment: string;

  constructor(
    private readonly executorService: ExecutorService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills/executors';
    Reflect.defineMetadata('path', this.environment, ExecutorController);
    console.log('Version - 20250123 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Post()
  async createExecutor(
    @Body() createExecutorDto: CreateExecutorDto,
  ): Promise<GeneralResponseDto> {
    return this.executorService.createExecutor(createExecutorDto);
  }

  @Get('/:execId')
  async getExecutorById(
    @Param('execId', ParseUUIDPipe) execId: string,
  ): Promise<GeneralResponseDto> {
    return this.executorService.getExecutorById(execId);
  }

  @Put('/:execId')
  async updateExecutor(
    @Param('execId', ParseUUIDPipe) execId: string,
    @Body() updateExecutorDto: UpdateExecutorDto,
  ): Promise<GeneralResponseDto> {
    return this.executorService.updateExecutor(execId, updateExecutorDto);
  }

  @Delete('/:execId')
  async deleteExecutor(
    @Param('execId', ParseUUIDPipe) execId: string,
  ): Promise<GeneralResponseDto> {
    return this.executorService.deleteExecutor(execId);
  }
}
