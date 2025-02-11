import { HttpException, HttpStatus } from '@nestjs/common';
import { GeneralResponseDto } from '../response.dto';
import { ConfigService } from '../../config/config.service';

export function processException(error: any): never {
  const configService = new ConfigService();
  const env = configService.getNodeEnv();

  const response = new GeneralResponseDto({
    code: 0,
    msg: '',
    response: null,
  });

  switch (error.name) {
    case 'PrismaClientValidationError':
      response.code = 400;
      response.msg = env !== 'prod' ? error.message : 'Validation error';
      throw new HttpException(response, HttpStatus.BAD_REQUEST);
    case 'PrismaClientKnownRequestError':
      response.code = 400;
      response.msg = env !== 'prod' ? error.message : 'Validation error';
      throw new HttpException(response, HttpStatus.BAD_REQUEST);
    case 'HttpException':
      throw error;
    case 'NotFoundError':
      response.code = 404;
      response.msg = 'Not Found';
      throw new HttpException(response, HttpStatus.NOT_FOUND);
    default:
      console.log('Unexpected error: ', error);
      response.code = 500;
      response.msg = env !== 'prod' ? error.message : 'Internal server error';
      throw new HttpException(response, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
