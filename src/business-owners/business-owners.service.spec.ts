import { Test, TestingModule } from '@nestjs/testing';
import { BusinessOwnersService } from './business-owners.service';

describe('BusinessOwnersService', () => {
  let service: BusinessOwnersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessOwnersService],
    }).compile();

    service = module.get<BusinessOwnersService>(BusinessOwnersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
