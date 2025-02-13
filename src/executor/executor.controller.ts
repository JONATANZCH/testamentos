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

@Controller('wills')
export class ExecutorController {
  private readonly environment: string;

  constructor(
    private readonly executorService: ExecutorService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills';
    Reflect.defineMetadata('path', this.environment, ExecutorController);
    console.log('Version - 20250123 11:00am');
    console.log('Environment running -> ' + this.environment);
  }

  @Post('/executors')
  async createExecutor(
    @Body() createExecutorDto: CreateExecutorDto,
  ): Promise<GeneralResponseDto> {
    return this.executorService.createExecutor(createExecutorDto);
  }

  @Get('/executors/:execId')
  async getExecutorById(
    @Param('execId', ParseUUIDPipe) execId: string,
  ): Promise<GeneralResponseDto> {
    return this.executorService.getExecutorById(execId);
  }

  @Get('/:userId/executors')
  async getUserExecutors(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<GeneralResponseDto> {
    return this.executorService.getUserExecutors(userId);
  }

  @Put('/executors/:execId')
  async updateExecutor(
    @Param('execId', ParseUUIDPipe) execId: string,
    @Body() updateExecutorDto: UpdateExecutorDto,
  ): Promise<GeneralResponseDto> {
    return this.executorService.updateExecutor(execId, updateExecutorDto);
  }

  @Delete('/executors/:execId')
  async deleteExecutor(
    @Param('execId', ParseUUIDPipe) execId: string,
  ): Promise<GeneralResponseDto> {
    return this.executorService.deleteExecutor(execId);
  }
}
