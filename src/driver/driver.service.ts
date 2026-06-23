import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Driver } from './entities/driver.entity';
import { CreateDriverDto } from './dto/create-driver.dto';

@Injectable()
export class DriverService {
  private readonly saltRounds = 12;

  constructor(
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateDriverDto) {
    const existing = await this.driverRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const driver = await this.driverRepo.save(
      this.driverRepo.create({
        ...dto,
        password: await bcrypt.hash(dto.password, this.saltRounds),
      }),
    );
    return this.safe(driver);
  }

  async login(email: string, password: string) {
    const driver = await this.driverRepo.findOne({ where: { email } });
    if (!driver || !(await bcrypt.compare(password, driver.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!driver.isActive) {
      throw new UnauthorizedException('Driver account is inactive');
    }
    const token = this.jwtService.sign({
      driverId: driver.id,
      role: 'DRIVER',
    });
    return { token, driver: this.safe(driver) };
  }

  async getProfile(driverId: string) {
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    return this.safe(driver);
  }

  private safe(driver: Driver) {
    const { password, ...rest } = driver;
    void password;
    return rest;
  }
}
