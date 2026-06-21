import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { Business } from './entities/business.entity';
import { BusinessJwtStrategy } from './strategies/business-jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Business]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'mySecretKey',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [BusinessService, BusinessJwtStrategy],
  controllers: [BusinessController],
  exports: [JwtService],
})
export class BusinessModule {}
