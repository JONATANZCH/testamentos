import { Test, TestingModule } from '@nestjs/testing';
import { LegalEntitiesService } from './legal-entities.service';

describe('LegalEntitiesService', () => {
  let service: LegalEntitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LegalEntitiesService],
    }).compile();

    service = module.get<LegalEntitiesService>(LegalEntitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
