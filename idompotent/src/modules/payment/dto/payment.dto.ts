import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  orderId: number;
}

export class MockPhonePeWebhookDto {
  @IsNotEmpty()
  @IsString()
  response: string; // Base64 encoded payload following PhonePe standard
}
