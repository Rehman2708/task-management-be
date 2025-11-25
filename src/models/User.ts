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
  font?: string | null;
  about?: string | null;
  theme: { light: string; dark: string };
}

// Document type for Mongoose
export interface IUserDocument extends IUser, Document {}

const UserSchema = new mongoose.Schema<IUserDocument>(
  {
    name: { type: String, required: true },
    userId: { type: String, required: true, unique: true, immutable: true },
    partnerUserId: { type: String, default: null },
    password: { type: String, required: true },
    notificationToken: { type: String, required: false },
    image: { type: String, required: false },
    font: { type: String, required: false, default: "Montserrat" },
    about: { type: String, required: false },
    theme: {
      dark: { type: String, required: true, default: "#3F87E9" },
      light: { type: String, required: true, default: "#6697D9" },
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUserDocument>("User", UserSchema);
