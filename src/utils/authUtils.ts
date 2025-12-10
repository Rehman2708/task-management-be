import crypto from "crypto";
import User from "../models/User.js";

/**
 * Generate a unique userId - always unique and uppercase
 */
export async function generateUserId(name: string): Promise<string> {
  let userId: string;

  // Keep generating until we find a unique userId
  do {
    // Generate random 8-character string with letters and numbers
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    userId = "";
    for (let i = 0; i < 8; i++) {
      userId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (await User.exists({ userId }));

  return userId;
}

/**
 * Generate a 6-digit OTP
 */
export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Send OTP email using Firebase Email Service
 */
export async function sendOTPEmail(
  email: string,
  otp: string,
  name: string
): Promise<boolean> {
  try {
    const { FirebaseEmailService } = await import(
      "../services/firebaseService.js"
    );
    return await FirebaseEmailService.sendOTPEmail(email, otp, name);
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    return false;
  }
}
