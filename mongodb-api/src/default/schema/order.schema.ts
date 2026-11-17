import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  orderNumber: string;

  @Prop({ required: true })
  productId: string; // The 8-string ID you mentioned

  @Prop({ required: true })
  pointsCost: number; // How many points the product costs
}

export const OrderSchema = SchemaFactory.createForClass(Order);