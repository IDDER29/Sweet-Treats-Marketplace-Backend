import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { UsersService } from './user.service';
import { Users } from '../entities/users.entity';
import { MailService } from '../mail/mail.service';
import { RefreshTokenService } from '../auth/refresh-token.service';

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    softDelete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let jwt: { sign: jest.Mock; decode: jest.Mock; verify: jest.Mock };
  let mail: { sendPasswordReset: jest.Mock };
  let refreshTokens: { issue: jest.Mock; rotate: jest.Mock; revoke: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ user_id: 'u1', ...x })),
      findOne: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    jwt = {
      sign: jest.fn(() => 'signed.jwt.token'),
      decode: jest.fn(),
      verify: jest.fn(),
    };
    mail = { sendPasswordReset: jest.fn() };
    refreshTokens = {
      issue: jest.fn().mockResolvedValue('refresh-token-xyz'),
      rotate: jest.fn(),
      revoke: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(Users), useValue: repo },
        { provide: JwtService, useValue: jwt },
        { provide: MailService, useValue: mail },
        { provide: RefreshTokenService, useValue: refreshTokens },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('register', () => {
    it('hashes the password before saving', async () => {
      await service.register({
        first_name: 'A',
        last_name: 'B',
        email: 'a@b.com',
        password: 'plaintext',
      } as any);
      const saved = repo.save.mock.calls[0][0];
      expect(saved.password).not.toBe('plaintext');
      expect(await bcrypt.compare('plaintext', saved.password)).toBe(true);
    });
  });

  describe('login', () => {
    it('returns a signed token on valid credentials', async () => {
      const hash = await bcrypt.hash('pw', 10);
      repo.findOne.mockResolvedValue({
        user_id: 'u1',
        email: 'a@b.com',
        password: hash,
        role: 'USER',
      });
      const res: any = await service.login({
        email: 'a@b.com',
        password: 'pw',
      } as any);
      expect(res.token).toBe('signed.jwt.token');
    });

    it('throws NotFound when the user does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@y.com', password: 'pw' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Unauthorized on a wrong password', async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'u1',
        password: await bcrypt.hash('right', 10),
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh tokens', () => {
    it('login issues an access token and a refresh token', async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'u1',
        email: 'a@b.com',
        password: await bcrypt.hash('pw', 12),
        role: 'USER',
      });
      const res: any = await service.login({
        email: 'a@b.com',
        password: 'pw',
      } as any);
      expect(res.token).toBe('signed.jwt.token');
      expect(res.refreshToken).toBe('refresh-token-xyz');
    });

    it('refreshSession rotates and returns a new pair', async () => {
      refreshTokens.rotate.mockResolvedValue({
        userId: 'u1',
        kind: 'user',
        token: 'next',
      });
      repo.findOne.mockResolvedValue({ user_id: 'u1', role: 'USER' });
      const res = await service.refreshSession('old');
      expect(res.token).toBe('signed.jwt.token');
      expect(res.refreshToken).toBe('next');
    });

    it('refreshSession rejects an unknown/expired refresh token', async () => {
      refreshTokens.rotate.mockResolvedValue(null);
      await expect(service.refreshSession('bad')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('MFA (TOTP)', () => {
    // Stub for getMfaSecret()'s QueryBuilder: createQueryBuilder().select().where().getRawOne()
    const qbRaw = (raw: any) => {
      const qb: any = {
        select: () => qb,
        where: () => qb,
        getRawOne: () => Promise.resolve(raw),
      };
      return qb;
    };

    it('enrollMfa mints a secret + otpauth URL without enabling yet', async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'u1',
        email: 'a@b.com',
        mfa_enabled: false,
      });
      const res: any = await service.enrollMfa('u1');
      expect(res.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
      expect(res.secret).toBeTruthy();
      expect(repo.update).toHaveBeenCalledWith('u1', {
        mfa_secret: res.secret,
      });
    });

    it('enrollMfa rejects when MFA is already enabled', async () => {
      repo.findOne.mockResolvedValue({ user_id: 'u1', mfa_enabled: true });
      await expect(service.enrollMfa('u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('activateMfa enables MFA for a valid code', async () => {
      const secret = authenticator.generateSecret();
      repo.createQueryBuilder.mockReturnValue(qbRaw({ mfa_secret: secret }));
      await service.activateMfa('u1', authenticator.generate(secret));
      expect(repo.update).toHaveBeenCalledWith('u1', { mfa_enabled: true });
    });

    it('activateMfa rejects an invalid code', async () => {
      const secret = authenticator.generateSecret();
      repo.createQueryBuilder.mockReturnValue(qbRaw({ mfa_secret: secret }));
      await expect(service.activateMfa('u1', '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('login demands a TOTP code when MFA is enabled', async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'u1',
        password: await bcrypt.hash('pw', 10),
        role: 'USER',
        mfa_enabled: true,
      });
      await expect(
        service.login({ email: 'a@b.com', password: 'pw' } as any),
      ).rejects.toThrow('MFA code required');
    });

    it('login rejects an invalid TOTP code', async () => {
      const secret = authenticator.generateSecret();
      repo.findOne.mockResolvedValue({
        user_id: 'u1',
        password: await bcrypt.hash('pw', 10),
        role: 'USER',
        mfa_enabled: true,
      });
      repo.createQueryBuilder.mockReturnValue(qbRaw({ mfa_secret: secret }));
      await expect(
        service.login({
          email: 'a@b.com',
          password: 'pw',
          totpCode: '000000',
        } as any),
      ).rejects.toThrow('Invalid MFA code');
    });

    it('login succeeds with a valid TOTP code', async () => {
      const secret = authenticator.generateSecret();
      repo.findOne.mockResolvedValue({
        user_id: 'u1',
        email: 'a@b.com',
        password: await bcrypt.hash('pw', 10),
        role: 'USER',
        mfa_enabled: true,
      });
      repo.createQueryBuilder.mockReturnValue(qbRaw({ mfa_secret: secret }));
      const res: any = await service.login({
        email: 'a@b.com',
        password: 'pw',
        totpCode: authenticator.generate(secret),
      } as any);
      expect(res.token).toBe('signed.jwt.token');
    });
  });

  describe('getProfile', () => {
    it('never returns the password hash', async () => {
      repo.findOne.mockResolvedValue({
        user_id: 'u1',
        email: 'a@b.com',
        password: 'secret-hash',
      });
      const profile: any = await service.getProfile('u1');
      expect(profile.password).toBeUndefined();
      expect(profile.email).toBe('a@b.com');
    });

    it('throws NotFound for a missing user', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getProfile('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('throws NotFound when no row was updated', async () => {
      repo.update.mockResolvedValue({ affected: 0 });
      await expect(
        service.updateProfile('nope', { address: 'x' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('changePassword', () => {
    it('throws NotFound when the user is missing (no null deref)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.changePassword('nope', {
          oldPassword: 'a',
          newPassword: 'b',
        } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteAccount', () => {
    it('soft-deletes and confirms', async () => {
      repo.softDelete.mockResolvedValue({ affected: 1 });
      const res = await service.deleteAccount('u1');
      expect(repo.softDelete).toHaveBeenCalledWith('u1');
      expect(res.message).toMatch(/deleted/i);
    });

    it('throws NotFound when nothing was deleted', async () => {
      repo.softDelete.mockResolvedValue({ affected: 0 });
      await expect(service.deleteAccount('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('returns a generic message even when the email is unknown', async () => {
      repo.findOne.mockResolvedValue(null);
      const res = await service.forgotPassword('ghost@x.com');
      expect(res.message).toMatch(/if that email exists/i);
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword (single-use, hash-bound)', () => {
    it('rejects a token whose purpose is not password-reset', async () => {
      jwt.decode.mockReturnValue({ userId: 'u1', purpose: 'login' });
      await expect(
        service.resetPassword('tok', 'newpw'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when verification fails (e.g. token already used)', async () => {
      jwt.decode.mockReturnValue({ userId: 'u1', purpose: 'password-reset' });
      repo.findOne.mockResolvedValue({ user_id: 'u1', password: 'hash' });
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      await expect(
        service.resetPassword('tok', 'newpw'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('resets the password when the token verifies', async () => {
      jwt.decode.mockReturnValue({ userId: 'u1', purpose: 'password-reset' });
      repo.findOne.mockResolvedValue({ user_id: 'u1', password: 'oldhash' });
      jwt.verify.mockReturnValue({ userId: 'u1' });
      const res = await service.resetPassword('tok', 'newpw');
      const saved = repo.save.mock.calls[0][0];
      expect(await bcrypt.compare('newpw', saved.password)).toBe(true);
      expect(res.message).toMatch(/reset/i);
    });
  });
});
