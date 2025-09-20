import mongoose, { Document } from "mongoose";

export interface IUser {
  name: string;
  userId: string;
  partnerUserId?: string | null;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  notificationToken?: string | null;
  image?: string | null;
}

// Document type for Mongoose
export interface IUserDocument extends IUser, Document {}

const UserSchema = new mongoose.Schema<IUserDocument>(
  {
    name: { type: String, required: true },
    userId: { type: String, required: true, unique: true },
    partnerUserId: { type: String, default: null },
    password: { type: String, required: true },
    notificationToken: { type: String, required: false },
    image: { type: String, required: false },
  },
  { timestamps: true }
);

export default mongoose.model<IUserDocument>("User", UserSchema);
