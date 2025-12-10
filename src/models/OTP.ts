import mongoose, { Document } from "mongoose";

export interface IOTP {
  email: string;
  otp: string;
  name: string;
  partnerUserId?: string | null;
  password: string;
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
}

export interface IOTPDocument extends IOTP, Document {}

const OTPSchema = new mongoose.Schema<IOTPDocument>(
  {
    email: { type: String, required: true },
    otp: { type: String, required: true },
    name: { type: String, required: true },
    partnerUserId: { type: String, default: null },
    password: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Create compound index for email and otp
OTPSchema.index({ email: 1, otp: 1 });

export default mongoose.model<IOTPDocument>("OTP", OTPSchema);
