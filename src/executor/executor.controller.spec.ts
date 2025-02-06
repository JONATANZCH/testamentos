import { Test, TestingModule } from '@nestjs/testing';
import { ExecutorController } from './executor.controller';
import { ExecutorService } from './executor.service';

describe('ExecutorController', () => {
  let controller: ExecutorController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecutorController],
      providers: [ExecutorService],
    }).compile();

    controller = module.get<ExecutorController>(ExecutorController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
