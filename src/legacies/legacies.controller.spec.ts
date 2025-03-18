import { Test, TestingModule } from '@nestjs/testing';
import { LegaciesController } from './legacies.controller';
import { LegaciesService } from './legacies.service';

describe('LegaciesController', () => {
  let controller: LegaciesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LegaciesController],
      providers: [LegaciesService],
    }).compile();

    controller = module.get<LegaciesController>(LegaciesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
