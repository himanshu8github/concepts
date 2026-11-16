import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;
}

