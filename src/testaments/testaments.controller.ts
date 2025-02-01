import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TestamentsService } from './testaments.service';
import {
  CreateTestamentDto,
  UpdateTestamentDto,
  CreateAssignmentDto,
} from './dto';
import { GeneralResponseDto, PaginationDto } from '../common';
import { ConfigService } from '../config';

@Controller('wills/users')
export class TestamentsController {
  private readonly environment: string;

  constructor(
    private readonly testamentsService: TestamentsService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills/users';
    Reflect.defineMetadata('path', this.environment, TestamentsController);
  }

  @Get('/:userId/testaments')
  async getUserTestaments(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.getUserTestaments(userId, paginationDto);
  }

  @Get('/:userId/testaments/:testamentId')
  async getTestamentById(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.getTestamentById(userId, testamentId);
  }

  @Post('/:userId/testaments')
  async createTestament(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() createTestamentDto: CreateTestamentDto,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.createTestament(userId, createTestamentDto);
  }

  @Put('/:userId/testaments/:testamentId')
  async updateTestament(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Body() updateTestamentDto: UpdateTestamentDto,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.updateTestament(
      userId,
      testamentId,
      updateTestamentDto,
    );
  }

  @Delete('/:userId/testaments/:testamentId')
  async deleteTestament(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.deleteTestament(userId, testamentId);
  }

  @Post('/:userId/testaments/:testamentId/assignments')
  async createAssignment(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Body() createAssignmentDto: CreateAssignmentDto,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.createAssignment(
      userId,
      testamentId,
      createAssignmentDto,
    );
  }
}
