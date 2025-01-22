import { Test, TestingModule } from '@nestjs/testing';
import { getPrismaClient } from './prisma-provider';

describe('Prisma', () => {
  let provider: getPrismaClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [getPrismaClient],
    }).compile();

    provider = module.get<getPrismaClient>(getPrismaClient);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
