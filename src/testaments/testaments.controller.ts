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
import { GeneralResponseDto, TestamentQueryDto } from '../common';
import { ConfigService } from '../config';

@Controller('wills')
export class TestamentsController {
  private readonly environment: string;

  constructor(
    private readonly testamentsService: TestamentsService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills';
    Reflect.defineMetadata('path', this.environment, TestamentsController);
  }

  @Get('/users/:userId/testaments')
  async getUserTestaments(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() queryDto: TestamentQueryDto,
  ): Promise<GeneralResponseDto> {
    const { page, limit, status, version } = queryDto;
    return this.testamentsService.getUserTestaments(
      userId,
      { page, limit },
      status,
      version,
    );
  }

  @Get('/testaments/:testamentId')
  async getTestamentById(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.getTestamentById(testamentId);
  }

  @Post('/users/:userId/testaments')
  async createTestament(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() createTestamentDto: CreateTestamentDto,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.createTestament(userId, createTestamentDto);
  }

  @Put('/testaments/:testamentId')
  async updateTestament(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Body() updateTestamentDto: UpdateTestamentDto,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.updateTestament(
      testamentId,
      updateTestamentDto,
    );
  }

  @Delete('/testaments/:testamentId')
  async deleteTestament(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.deleteTestament(testamentId);
  }

  @Post('testaments/:testamentId/assignments')
  async createAssignment(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Body() createAssignmentDto: CreateAssignmentDto,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.createAssignment(
      testamentId,
      createAssignmentDto,
    );
  }

  @Delete('testaments/:testamentId/assignments')
  async deleteAssignment(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.deleteAssignment(testamentId);
  }
}
