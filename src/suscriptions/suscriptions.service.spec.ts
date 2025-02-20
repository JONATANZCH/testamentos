import { Test, TestingModule } from '@nestjs/testing';
import { SuscriptionsService } from './suscriptions.service';

describe('SuscriptionsService', () => {
  let service: SuscriptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuscriptionsService],
    }).compile();

    service = module.get<SuscriptionsService>(SuscriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
