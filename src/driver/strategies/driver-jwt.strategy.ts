import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class DriverJwtStrategy extends PassportStrategy(Strategy, 'driver') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'mySecretKey',
    });
  }

  async validate(payload: any) {
    return { driverId: payload.driverId, role: payload.role };
  }
}
