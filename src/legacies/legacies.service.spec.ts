import { Test, TestingModule } from '@nestjs/testing';
import { LegaciesService } from './legacies.service';

describe('LegaciesService', () => {
  let service: LegaciesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LegaciesService],
    }).compile();

    service = module.get<LegaciesService>(LegaciesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
