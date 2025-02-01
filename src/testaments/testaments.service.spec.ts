import { Test, TestingModule } from '@nestjs/testing';
import { TestamentsService } from './testaments.service';

describe('TestamentsService', () => {
  let service: TestamentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestamentsService],
    }).compile();

    service = module.get<TestamentsService>(TestamentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
