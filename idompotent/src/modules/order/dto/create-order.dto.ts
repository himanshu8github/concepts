import { IsInt, IsNotEmpty, IsPositive, Min } from 'class-validator';

export class PlaceOrderDto {
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  userId: number;

  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  productId: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;
}
