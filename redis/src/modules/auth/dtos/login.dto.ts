import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Phone number must be a valid E.164 phone number',
  })
  phoneNumber: string;

  @IsNotEmpty({ message: 'OTP is required' })
  @IsString()
  @Length(6, 6)
  otp: string;
}
