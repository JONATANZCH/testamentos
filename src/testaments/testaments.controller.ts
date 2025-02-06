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
    // We allow both a single object and an array
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
        // Call to the service to process the assignment.
        // The service is assumed to return a GeneralResponseDto with a code (e.g. 201 on success).
        const result: GeneralResponseDto =
          await this.testamentsService.createAssignment(
            testamentId,
            assignmentDto,
          );

        // If the result does not indicate success, we log it as an error.
        if (result.code !== 201) {
          errorResults.push({
            assignment: assignmentDto,
            error: result.msg,
          });
        }
        successfulResults.push(result);
      } catch (error) {
        // We catch unexpected errors.
        errorResults.push({
          assignment: assignmentDto,
          error: error.message || error,
        });
      }
    }

    // If there were errors in any of the processing, a partial response is returned.
    if (errorResults.length > 0) {
      return {
        code: 207, // Code 207 (Multi-Status) to indicate partial processing.
        msg: 'Some assignments failed to process',
        response: {
          successes: successfulResults.filter((res) => res.code === 201),
          errors: errorResults,
        },
      };
    }

    // If all assignments were processed successfully, a success response is returned.
    return {
      code: 201,
      msg: 'All assignments created successfully',
      response: successfulResults,
    };
  }

  @Delete('testaments/:testamentId/assignments')
  async deleteAssignment(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.deleteAssignment(testamentId);
  }
}
