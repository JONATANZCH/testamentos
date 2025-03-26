import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { GeneralResponseDto } from '../common';
import { SendMessagesService } from './send-messages.service';
import { ConfigService } from '../config';
import { SendTestamentDto } from './dto/send-messages.dto';

@Controller('wills/send-messages')
export class SendMessagesController {
  private readonly environment: string;

  constructor(
    private readonly sendMessagesService: SendMessagesService,
    private readonly configService: ConfigService,
  ) {
    this.environment = this.configService.getNodeEnv() + '/wills/send-messages';
    Reflect.defineMetadata('path', this.environment, SendMessagesController);
    console.log('Version - 20250325 15:00pm');
    console.log('Environment running -> ' + this.environment);
  }

  @Post('/:userId')
  async sendMessage(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() sendTestamentDto: SendTestamentDto,
  ): Promise<GeneralResponseDto> {
    console.log('[SendMessagesController] sendInstantMessage, entering...');
    return this.sendMessagesService.sendInstantMessage(
      userId,
      sendTestamentDto,
    );
  }
}
