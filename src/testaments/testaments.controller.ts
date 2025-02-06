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
    @Body() body: CreateAssignmentDto | CreateAssignmentDto[],
  ): Promise<GeneralResponseDto> {
    // We check if the body is an array; otherwise, we convert it to an array.
    const assignments: CreateAssignmentDto[] = Array.isArray(body)
      ? body
      : [body];

    // Arrays to accumulate successful results and errors.
    const successfulResults = [];
    const errorResults = [];

    // We process each assignment individually.
    for (const assignmentDto of assignments) {
      try {
        const result = await this.testamentsService.createAssignment(
          testamentId,
          assignmentDto,
        );

        // If successful, add it to successfulResults
        if (result.code === 201) {
          successfulResults.push({
            assingationId: result.response.id,
            assetId: result.response.assetId,
            assignmentType: result.response.assignmentType,
            assignmentId: result.response.assignmentId,
          });
        } else {
          // If the response indicates failure, log the error result
          errorResults.push({
            assingationId: assignmentDto.assignmentId,
            assetId: assignmentDto.assetId,
            assignmentType: assignmentDto.assignmentType,
            assignmentId: assignmentDto.assignmentId,
            msg: result.msg,
          });
        }
      } catch (error) {
        // Catch unexpected errors
        errorResults.push({
          assingationId: assignmentDto.assignmentId,
          assetId: assignmentDto.assetId,
          assignmentType: assignmentDto.assignmentType,
          assignmentId: assignmentDto.assignmentId,
          msg: error.message || 'Unexpected error occurred',
        });
      }
    }

    // Construct the response payload
    return {
      code: 201,
      msg: 'Assignments processed',
      response: [
        {
          received: assignments.length,
          success: {
            count: successfulResults.length,
            detail: successfulResults,
          },
          failed: {
            count: errorResults.length,
            detail: errorResults,
          },
        },
      ],
    };
  }

  @Delete('testaments/:testamentId/assignments')
  async deleteAssignment(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.deleteAssignment(testamentId);
  }
}
