import { Test, TestingModule } from '@nestjs/testing';
import { TestamentsController } from './testaments.controller';
import { TestamentsService } from './testaments.service';

describe('TestamentsController', () => {
  let controller: TestamentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestamentsController],
      providers: [TestamentsService],
    }).compile();

    controller = module.get<TestamentsController>(TestamentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
