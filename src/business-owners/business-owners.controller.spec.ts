import { Test, TestingModule } from '@nestjs/testing';
import { BusinessOwnersController } from './business-owners.controller';

describe('BusinessOwnersController', () => {
  let controller: BusinessOwnersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessOwnersController],
    }).compile();

    controller = module.get<BusinessOwnersController>(BusinessOwnersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
