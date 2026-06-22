import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../entities/users.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Users)
    private usersRepository: Repository<Users>,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const { password, ...userData } = createUserDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.usersRepository.create({
      ...userData,
      password: hashedPassword,
    });
    return await this.usersRepository.save(user);
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { userId: user.user_id, role: user.role };
    const token = this.jwtService.sign(payload);

    return {
      token,
      userId: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
    };
  }

  async getProfile(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { user_id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // Never expose the password hash to clients.
    const { password, ...profile } = user;
    return profile;
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    const result = await this.usersRepository.update(userId, updateUserDto);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
    return this.getProfile(userId);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;
    const user = await this.usersRepository.findOne({
      where: { user_id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordMatch) {
      throw new UnauthorizedException('Incorrect old password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await this.usersRepository.save(user);

    return { message: 'Password updated successfully' };
  }

  async deleteAccount(userId: string) {
    await this.usersRepository.delete(userId);
    return { message: 'Account deleted successfully' };
  }

  // Per-user signing secret for reset tokens, bound to the current password
  // hash. When the password changes the hash changes, so any previously issued
  // reset token stops verifying — making reset links effectively single-use.
  private resetTokenSecret(user: Users): string {
    return `${process.env.JWT_SECRET || 'mySecretKey'}:${user.password}`;
  }

  async forgotPassword(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });

    // Always return the same message to avoid revealing whether the email exists
    if (user) {
      const token = this.jwtService.sign(
        { userId: user.user_id, purpose: 'password-reset' },
        { secret: this.resetTokenSecret(user), expiresIn: '1h' },
      );
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${token}`;
      const name = user.first_name || user.email;
      this.mailService.sendPasswordReset(email, name, resetLink);
    }

    return { message: 'If that email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    // Decode (without verifying) only to learn which user the token is for, so
    // we can rebuild their per-user secret.
    const decoded: any = this.jwtService.decode(token);
    if (!decoded || decoded.purpose !== 'password-reset' || !decoded.userId) {
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.usersRepository.findOne({
      where: { user_id: decoded.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify the signature against the hash-bound secret (also enforces expiry).
    try {
      this.jwtService.verify(token, { secret: this.resetTokenSecret(user) });
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.save(user);

    return { message: 'Password reset successfully' };
  }
}
