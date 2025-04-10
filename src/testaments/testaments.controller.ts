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
  HttpException,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { TestamentsService } from './testaments.service';
import {
  CreateTestamentDto,
  CreateAssignmentDto,
  UpdateAssignmentDto,
  UpdateTestamentDto,
} from './dto';
import {
  GeneralResponseDto,
  PaginationDto,
  TestamentQueryDto,
} from '../common';
import { ConfigService } from '../config';
import { UpdateTestamentMintDto, UpdateMinorSupportDto } from './dto';
import { Response } from 'express';

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
    console.log('[TestamentsController] getUserTestaments, entering...');
    const { page, limit, status, version } = queryDto;
    return this.testamentsService.getUserTestaments(
      userId,
      { page, limit },
      status,
      version,
    );
  }

  @Get('/testaments/:testamentId')
  async getTestamentByIdOrFile(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Query('type') type: 'metadata' | 'pdf' = 'metadata', // por defecto 'metadata'
    @Res() res: Response,
  ) {
    if (type === 'pdf') {
      console.log('streaming pdf');
      return this.testamentsService.streamTestamentPdf(testamentId, res);
    } else {
      console.log('getting metadata');
      return this.testamentsService.getTestamentById(testamentId, res);
    }
  }

  @Post('/users/:userId/testaments')
  async createTestament(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() createTestamentDto: CreateTestamentDto,
  ): Promise<GeneralResponseDto> {
    console.log('[TestamentsController] createTestament, entering...');
    return this.testamentsService.createTestament(userId, createTestamentDto);
  }

  @Put('/testaments/:testamentId')
  async updateTestament(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Body() updateTestamentDto: UpdateTestamentDto,
  ): Promise<GeneralResponseDto> {
    console.log('[TestamentsController] updateTestament, entering...');
    return this.testamentsService.updateTestament(
      testamentId,
      updateTestamentDto,
    );
  }

  @Delete('/testaments/:testamentId')
  async deleteTestament(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    console.log('[TestamentsController] deleteTestament, entering...');
    return this.testamentsService.deleteTestament(testamentId);
  }

  @Post('/testaments/:testamentId/assignments')
  async createAssignment(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Body() body: CreateAssignmentDto | CreateAssignmentDto[],
  ): Promise<GeneralResponseDto> {
    console.log('[TestamentsController] createAssignment, entering...');
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
        console.log('Service returned:', JSON.stringify(result, null, 2));

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
            msg: result.msg || 'Error creating assignment',
          });
        }
      } catch (error) {
        let msg = error.message || 'Unexpected error occurred';
        if (error instanceof HttpException) {
          const responseData = error.getResponse();
          if (typeof responseData === 'object' && responseData !== null) {
            msg =
              (responseData as any).msg || 'HttpException without msg field';
          } else if (typeof responseData === 'string') {
            msg = responseData;
          }
        }
        errorResults.push({
          assingationId: assignmentDto.assignmentId,
          assetId: assignmentDto.assetId,
          assignmentType: assignmentDto.assignmentType,
          assignmentId: assignmentDto.assignmentId,
          msg,
        });
      }
    }

    if (successfulResults.length === 0) {
      const response = new GeneralResponseDto({
        code: 422,
        msg: 'None of the assignments could be created',
        response: {
          received: assignments.length,
          success: { count: 0, detail: [] },
          failed: { count: errorResults.length, detail: errorResults },
        },
      });
      throw new HttpException(response, HttpStatus.UNPROCESSABLE_ENTITY);
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

  @Put('/testaments/:assignmentId/assignments')
  async updateAssignment(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() updateAssignmentDto: UpdateAssignmentDto,
  ): Promise<GeneralResponseDto> {
    console.log('[TestamentsController] updateAssignment, entering...');
    return this.testamentsService.updateAssignment(
      assignmentId,
      updateAssignmentDto,
    );
  }

  @Get('/testaments/:testamentId/assignments')
  async getTestamentAssignments(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<GeneralResponseDto> {
    console.log(`[TestamentsController] getTestamentAssignments, entering...`);
    return this.testamentsService.getTestamentAssignments(
      testamentId,
      paginationDto,
    );
  }

  @Get('/:assignmentId/assignments')
  async getAssignmentById(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ): Promise<GeneralResponseDto> {
    console.log(`[TestamentsController] getAssignmentById, entering...`);
    return this.testamentsService.getAssignmentById(assignmentId);
  }

  @Delete('/testaments/:testamentId/assignments')
  async deleteAssignment(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    console.log('[TestamentsController] deleteAssignment, entering...');
    return this.testamentsService.deleteAssignment(testamentId);
  }

  @Put('/testaments/mint/:testamentId')
  async updateTestamentMint(
    @Param('testamentId', ParseUUIDPipe)
    testamentId: string,
    @Body() updateTestamentMintDto: UpdateTestamentMintDto,
  ): Promise<GeneralResponseDto> {
    return this.testamentsService.updateTestamentMint(
      testamentId,
      updateTestamentMintDto,
    );
  }

  @Put('/testaments/:testamentId/minor-support')
  async updateMinorSupport(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
    @Body() body: UpdateMinorSupportDto,
  ): Promise<GeneralResponseDto> {
    console.log('[TestamentsController] updateMinorSupport, entering...');
    return this.testamentsService.updateMinorSupport(testamentId, body);
  }

  @Get('/testaments/:testamentId/minor-support')
  async getMinorSupport(
    @Param('testamentId', ParseUUIDPipe) testamentId: string,
  ): Promise<GeneralResponseDto> {
    console.log('[TestamentsController] getMinorSupport, entering...');
    return this.testamentsService.getMinorSupport(testamentId);
  }
}
