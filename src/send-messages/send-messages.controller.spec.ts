import { Test, TestingModule } from '@nestjs/testing';
import { SendMessagesController } from './send-messages.controller';
import { SendMessagesService } from './send-messages.service';

describe('SendMessagesController', () => {
  let controller: SendMessagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SendMessagesController],
      providers: [SendMessagesService],
    }).compile();

    controller = module.get<SendMessagesController>(SendMessagesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
