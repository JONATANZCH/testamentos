import { Test, TestingModule } from '@nestjs/testing';
import { TestamentPdfService } from './testament-pdf.service';

describe('TestamentPdfService', () => {
  let service: TestamentPdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestamentPdfService],
    }).compile();

    service = module.get<TestamentPdfService>(TestamentPdfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
