import { Module } from '@nestjs/common';
import { UsersService } from './user.service';
import { UsersController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from '../entities/users.entity';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { RefreshTokenService } from '../auth/refresh-token.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Users]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'mySecretKey', // Use a strong secret in production!
        // Short-lived access token; clients refresh via /auth/refresh.
        signOptions: { expiresIn: process.env.JWT_ACCESS_TTL || '15m' },
      }),
    }),
    MailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, JwtStrategy, RefreshTokenService],
  exports: [UsersService],
})
export class UserModule {} // Ensure this is UsersModule
