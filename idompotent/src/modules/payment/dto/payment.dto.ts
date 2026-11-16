import { IsNotEmpty, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;
}

export class MockPhonePeWebhookDto {
  @IsNotEmpty()
  @IsString()
  response: string; // Base64 encoded payload per PhonePe specification
}

