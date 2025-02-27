import { Test, TestingModule } from '@nestjs/testing';
import { TestamentPdfController } from './testament-pdf.controller';
import { TestamentPdfService } from './testament-pdf.service';

describe('TestamentPdfController', () => {
  let controller: TestamentPdfController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestamentPdfController],
      providers: [TestamentPdfService],
    }).compile();

    controller = module.get<TestamentPdfController>(TestamentPdfController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
