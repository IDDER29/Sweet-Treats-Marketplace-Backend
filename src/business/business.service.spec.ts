import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { BusinessService } from './business.service';
import { Business } from './entities/business.entity';
import { RefreshTokenService } from '../auth/refresh-token.service';

const baseDto = {
  firstName: 'Sweet',
  lastName: 'Owner',
  businessName: 'Sweet Cakes',
  email: 'biz@test.com',
  password: 'password123',
  businessType: 'bakery',
  address: '1 Bakery Ln',
  phoneNumber: '555-0100',
  agreeToTerms: true,
};

describe('BusinessService', () => {
  let service: BusinessService;
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let jwt: { sign: jest.Mock };
  let refreshTokens: {
    issue: jest.Mock;
    rotate: jest.Mock;
    revoke: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'b1', ...x })),
    };
    jwt = { sign: jest.fn(() => 'biz.jwt.token') };
    refreshTokens = {
      issue: jest.fn().mockResolvedValue('biz-refresh-token'),
      rotate: jest.fn(),
      revoke: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        { provide: getRepositoryToken(Business), useValue: repo },
        { provide: JwtService, useValue: jwt },
        { provide: RefreshTokenService, useValue: refreshTokens },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
  });

  describe('create', () => {
    it('hashes the password and returns safe data only', async () => {
      repo.findOne.mockResolvedValue(null);
      const res = await service.create({ ...baseDto } as any);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.password).not.toBe('password123');
      expect(await bcrypt.compare('password123', saved.password)).toBe(true);
      expect((res.business as any).password).toBeUndefined();
      expect(res.business.email).toBe('biz@test.com');
    });

    it('throws Conflict when the email already exists', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(
        service.create({ ...baseDto } as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequest when terms are not agreed', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ ...baseDto, agreeToTerms: false } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('login', () => {
    it('returns a token and no password on valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 12);
      repo.findOne.mockResolvedValue({
        id: 'b1',
        firstName: 'Sweet',
        lastName: 'Owner',
        businessName: 'Sweet Cakes',
        email: 'biz@test.com',
        password: hash,
      });
      const res = await service.login('biz@test.com', 'password123');
      expect(res.token).toBe('biz.jwt.token');
      expect(res.refreshToken).toBe('biz-refresh-token');
      expect(refreshTokens.issue).toHaveBeenCalledWith('b1', 'business');
      expect((res.business as any).password).toBeUndefined();
    });

    it('throws Unauthorized for an unknown business', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.login('ghost@test.com', 'password123'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws Unauthorized on a wrong password', async () => {
      repo.findOne.mockResolvedValue({
        id: 'b1',
        password: await bcrypt.hash('right', 12),
      });
      await expect(
        service.login('biz@test.com', 'wrong'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh tokens', () => {
    it('refreshSession rotates and returns a new pair', async () => {
      refreshTokens.rotate.mockResolvedValue({
        userId: 'b1',
        kind: 'business',
        token: 'next-refresh',
      });
      repo.findOne.mockResolvedValue({ id: 'b1' });
      const res = await service.refreshSession('old');
      expect(res.token).toBe('biz.jwt.token');
      expect(res.refreshToken).toBe('next-refresh');
    });

    it('enforces the business kind when rotating (cross-kind rejected)', async () => {
      // The service asks rotate to enforce kind 'business'; a non-business token
      // resolves to null and is rejected.
      refreshTokens.rotate.mockResolvedValue(null);
      await expect(service.refreshSession('user-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokens.rotate).toHaveBeenCalledWith(
        'user-token',
        'business',
      );
    });

    it('rejects an unknown/expired refresh token', async () => {
      refreshTokens.rotate.mockResolvedValue(null);
      await expect(service.refreshSession('bad')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('logout revokes the token', async () => {
      await service.logout('some-token');
      expect(refreshTokens.revoke).toHaveBeenCalledWith('some-token');
    });
  });

  describe('findById', () => {
    it('rejects a non-UUID id', async () => {
      await expect(service.findById('not-a-uuid')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('strips the password from the returned business', async () => {
      repo.findOne.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'biz@test.com',
        password: 'secret',
      });
      const res = await service.findById(
        '11111111-1111-4111-8111-111111111111',
      );
      expect((res as any).password).toBeUndefined();
    });
  });
});
