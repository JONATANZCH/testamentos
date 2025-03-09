import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class RequiredTestamentIdPipe implements PipeTransform {
  transform(value: any) {
    if (!value) {
      throw new BadRequestException('The parameter "testamentId" is required.');
    }
    return value;
  }
}
