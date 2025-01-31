import { Test, TestingModule } from '@nestjs/testing';
import { LegalEntitiesController } from './legal-entities.controller';
import { LegalEntitiesService } from './legal-entities.service';

describe('LegalEntitiesController', () => {
  let controller: LegalEntitiesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LegalEntitiesController],
      providers: [LegalEntitiesService],
    }).compile();

    controller = module.get<LegalEntitiesController>(LegalEntitiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
