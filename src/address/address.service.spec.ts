import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AddressService } from './address.service';
import { Address } from './entities/address.entity';

describe('AddressService', () => {
  let service: AddressService;
  let repo: any;
  let unsetExec: jest.Mock;

  beforeEach(async () => {
    unsetExec = jest.fn().mockResolvedValue({});
    repo = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'a1', ...x })),
      update: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        update: () => ({
          set: () => ({ where: () => ({ execute: unsetExec }) }),
        }),
      })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressService,
        { provide: getRepositoryToken(Address), useValue: repo },
      ],
    }).compile();
    service = module.get(AddressService);
  });

  it('makes the first address the default', async () => {
    repo.count.mockResolvedValue(0);
    const res = await service.create('u1', {
      recipientName: 'A',
      line1: '1 St',
      city: 'Town',
      postcode: 'AB1 2CD',
    } as any);
    expect(res.isDefault).toBe(true);
    expect(res.country).toBe('GB'); // default
    expect(unsetExec).toHaveBeenCalled();
  });

  it('does not auto-default a subsequent address', async () => {
    repo.count.mockResolvedValue(2);
    const res = await service.create('u1', {
      recipientName: 'A',
      line1: '1 St',
      city: 'Town',
      postcode: 'AB1 2CD',
    } as any);
    expect(res.isDefault).toBe(false);
    expect(unsetExec).not.toHaveBeenCalled();
  });

  it('unsets other defaults when creating an explicit default', async () => {
    repo.count.mockResolvedValue(3);
    const res = await service.create('u1', {
      recipientName: 'A',
      line1: '1 St',
      city: 'Town',
      postcode: 'AB1 2CD',
      isDefault: true,
    } as any);
    expect(res.isDefault).toBe(true);
    expect(unsetExec).toHaveBeenCalled();
  });

  it('findOneOwned throws when not found for this user', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOneOwned('u1', 'a1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('setDefault unsets others then flips this one', async () => {
    repo.findOne.mockResolvedValue({ id: 'a1', isDefault: false });
    await service.setDefault('u1', 'a1');
    expect(unsetExec).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith('a1', { isDefault: true });
  });

  it('remove deletes an owned address', async () => {
    repo.findOne.mockResolvedValue({ id: 'a1' });
    const res = await service.remove('u1', 'a1');
    expect(repo.remove).toHaveBeenCalled();
    expect(res).toEqual({ deleted: true });
  });
});
