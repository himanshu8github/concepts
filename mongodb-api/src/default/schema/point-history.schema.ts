import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PointHistoryDocument = HydratedDocument<PointHistory>;

@Schema({ timestamps: true })
export class PointHistory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  points: number;

  // status: 1 for EARN, 2 for REDEEM (as requested)
  @Prop({ required: true, enum: [1, 2] })
  status: number; 

  @Prop({ default: 'System' })
  description: string; 
}

export const PointHistorySchema = SchemaFactory.createForClass(PointHistory);