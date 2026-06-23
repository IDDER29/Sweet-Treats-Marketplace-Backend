import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DriverService } from './driver.service';
import { Driver } from './entities/driver.entity';

describe('DriverService', () => {
  let service: DriverService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'd1', ...x })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverService,
        { provide: getRepositoryToken(Driver), useValue: repo },
        { provide: JwtService, useValue: { sign: () => 'driver.jwt' } },
      ],
    }).compile();
    service = module.get(DriverService);
  });

  it('hashes the password on register and returns no password', async () => {
    repo.findOne.mockResolvedValue(null);
    const res: any = await service.register({
      name: 'Dan',
      email: 'd@test.com',
      password: 'password8',
    } as any);
    const saved = repo.save.mock.calls[0][0];
    expect(saved.password).not.toBe('password8');
    expect(await bcrypt.compare('password8', saved.password)).toBe(true);
    expect(res.password).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    repo.findOne.mockResolvedValue({ id: 'existing' });
    await expect(
      service.register({
        name: 'X',
        email: 'd@test.com',
        password: 'password8',
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with a token on valid credentials', async () => {
    repo.findOne.mockResolvedValue({
      id: 'd1',
      email: 'd@test.com',
      password: await bcrypt.hash('password8', 12),
      isActive: true,
    });
    const res = await service.login('d@test.com', 'password8');
    expect(res.token).toBe('driver.jwt');
    expect((res.driver as any).password).toBeUndefined();
  });

  it('rejects a wrong password', async () => {
    repo.findOne.mockResolvedValue({
      id: 'd1',
      password: await bcrypt.hash('right', 12),
      isActive: true,
    });
    await expect(service.login('d@test.com', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an inactive driver', async () => {
    repo.findOne.mockResolvedValue({
      id: 'd1',
      password: await bcrypt.hash('password8', 12),
      isActive: false,
    });
    await expect(
      service.login('d@test.com', 'password8'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
