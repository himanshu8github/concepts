
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, versionKey: '__v'  })
export class User {
  @Prop({
    required: true,
    trim: true,
  })
  name: string;

  @Prop({
    required: true,
    lowercase: true,
    trim: true,
    unique: true,
    index: true,
  })
  email: string;

   @Prop({ default: 0 })
  walletPoints: number; 

  @Prop({
    required: true,
    trim: true,
    unique: true,
    index: true,
  })
  mobile: string;

  @Prop({
    required: true,
  })
  password: string;

    @Prop()
  __v: number; 

  @Prop({
    type: Number,
    min: 0,
    required: false,
  })
  age?: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
