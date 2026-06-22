import { IsString, Length, Matches } from 'class-validator';

export class MfaCodeDto {
  // 6-digit TOTP code.
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
