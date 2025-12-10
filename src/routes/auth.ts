import { Router } from "express";
import User, { IUserDocument, IUser } from "../models/User.js";
import OTP from "../models/OTP.js";
import { sendExpoPush } from "./notifications.js";
import { NotificationData } from "../enum/notification.js";
import { NotificationMessages } from "../utils/notificationMessages.js";
import bcrypt from "bcrypt";
import {
  generateUserId,
  generateOTP,
  sendOTPEmail,
} from "../utils/authUtils.js";

const router = Router();

interface Theme {
  light: string;
  dark: string;
}

interface PartnerResponse {
  userId: string;
  name: string;
  image: string | null;
  theme: Theme | null;
  font: string | null;
  about: string | null;
}

interface UserResponse {
  userId: string;
  name: string;
  email: string | null;
  partner: PartnerResponse | null;
  createdAt: Date;
  updatedAt: Date;
  image: string | null;
  font: string | null;
  about: string | null;
  theme: Theme | null;
}

async function formatUserResponse(
  u: IUserDocument | (IUser & { _id?: any }) | null
): Promise<UserResponse | null> {
  if (!u) return null;

  const partner = u.partnerUserId
    ? await User.findOne({ userId: u.partnerUserId }).lean<IUser | null>()
    : null;

  return {
    userId: u.userId,
    name: u.name,
    email: u.email ?? null,
    partner: partner
      ? {
          userId: partner.userId,
          name: partner.name,
          image: partner.image ?? null,
          theme: partner.theme ?? null,
          font: partner.font ?? null,
          about: partner.about ?? null,
        }
      : null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    image: u.image ?? null,
    theme: u.theme ?? null,
    font: u.font ?? null,
    about: u.about ?? null,
  };
}

/**
 * 🟢 Send OTP for Registration
 */
router.post("/send-otp", async (req, res) => {
  try {
    const { name, email, partnerUserId, password } = req.body || {};

    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "name, email, and password are required" });

    // Check if email already exists
    if (await User.exists({ email }))
      return res.status(409).json({ message: "Email already registered" });

    // Validate partner if provided
    let partner = null;
    if (partnerUserId) {
      partner = await User.findOne({ userId: partnerUserId });
      if (!partner)
        return res.status(400).json({ message: "Partner userId not found" });
    }

    // Generate OTP
    const otp = generateOTP();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store OTP data (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Remove any existing OTP for this email
    await OTP.deleteMany({ email });

    await OTP.create({
      email,
      otp,
      name: name.trim(),
      partnerUserId: partner?.userId ?? null,
      password: hashedPassword,
      expiresAt,
    });

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, name);
    if (!emailSent) {
      return res.status(500).json({ message: "Failed to send OTP email" });
    }

    res.status(200).json({
      message: "OTP sent successfully to your email",
      email,
    });
  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Verify OTP and Register User
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, notificationToken } = req.body || {};

    if (!email || !otp)
      return res.status(400).json({ message: "email and otp are required" });

    // Find and verify OTP
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    if (otpRecord.verified) {
      return res.status(400).json({ message: "OTP already used" });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: "OTP expired" });
    }

    // Generate unique userId
    const userId = await generateUserId(otpRecord.name);

    // Check if email already exists (double check)
    if (await User.exists({ email })) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Create user
    const newUser = await User.create({
      name: otpRecord.name,
      userId,
      email,
      password: otpRecord.password,
      notificationToken,
      partnerUserId: otpRecord.partnerUserId,
    });

    // Connect partner if specified
    if (otpRecord.partnerUserId) {
      const partner = await User.findOne({ userId: otpRecord.partnerUserId });
      if (partner) {
        partner.partnerUserId = newUser.userId;
        await partner.save();
      }
    }

    // Mark OTP as verified and clean up
    await OTP.deleteOne({ _id: otpRecord._id });

    res.status(201).json({
      message: "User registered successfully",
      user: await formatUserResponse(newUser),
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Login
 */
router.post("/login", async (req, res) => {
  try {
    const { identifier, password, notificationToken } = req.body || {};

    if (!identifier || !password)
      return res
        .status(400)
        .json({ message: "email/userId and password are required" });

    // Find user by email or userId
    const user = await User.findOne({
      $or: [{ email: identifier }, { userId: identifier }],
    });

    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    if (notificationToken) {
      user.notificationToken = notificationToken;
      await user.save();
    }

    res.json({
      message: "Login successful",
      user: await formatUserResponse(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Connect Partner
 */
router.post("/connect-partner", async (req, res) => {
  try {
    const { userId, partnerUserId } = req.body || {};

    if (!userId || !partnerUserId)
      return res
        .status(400)
        .json({ message: "userId and partnerUserId are required" });

    const [user, partner] = await Promise.all([
      User.findOne({ userId }),
      User.findOne({ userId: partnerUserId }),
    ]);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    if (user.partnerUserId)
      return res
        .status(400)
        .json({ message: "This user is already connected to someone else" });

    if (partner.partnerUserId)
      return res.status(400).json({
        message: "The partner user is already connected to someone else",
      });

    user.partnerUserId = partner.userId;
    partner.partnerUserId = user.userId;

    await Promise.all([user.save(), partner.save()]);

    const notifications = [];
    if (user.notificationToken)
      notifications.push(
        await sendExpoPush(
          [user.notificationToken],
          NotificationMessages.Profile.PartnerConnected,
          { userName: user.name, partnerName: partner.name, isForUser: true },
          { type: NotificationData.Profile },
          [userId]
        )
      );

    if (partner.notificationToken)
      notifications.push(
        await sendExpoPush(
          [partner.notificationToken],
          NotificationMessages.Profile.PartnerConnected,
          { userName: user.name, partnerName: partner.name, isForUser: false },
          { type: NotificationData.Profile },
          [partnerUserId]
        )
      );

    await Promise.all(notifications);

    res.json({
      message: "Partner connected successfully",
      user: await formatUserResponse(user),
    });
  } catch (err) {
    console.error("Connect partner error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Get User Details
 */
router.get("/:userId", async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      message: "User details fetched successfully",
      user: await formatUserResponse(user),
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Logout
 */
router.post("/logout", async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.notificationToken = null;
    await user.save();

    res.json({
      message: "Logout successful, notification token cleared",
      user: await formatUserResponse(user),
    });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Update Profile
 */
router.put("/update-profile", async (req, res) => {
  try {
    const { userId, name, image, about } = req.body || {};
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Detect changes (old → new)
    const nameChanged = name !== undefined && name !== user.name;

    const imageChanged = image !== undefined && image !== user.image;

    const aboutChanged = about !== undefined && about !== user.about;

    // Build changed fields object (for notification)
    const changedFields = [];

    if (nameChanged) {
      changedFields.push({
        field: "name",
        oldValue: String(user.name ?? ""),
        newValue: String(name ?? ""),
      });
    }

    if (imageChanged) {
      changedFields.push({
        field: "image",
        oldValue: String(user.image ?? ""),
        newValue: String(image ?? ""),
      });
    }

    if (aboutChanged) {
      changedFields.push({
        field: "about",
        oldValue: String(user.about ?? ""),
        newValue: String(about ?? ""),
      });
    }

    // Update fields
    if (name !== undefined) user.name = name;
    if (about !== undefined) user.about = about;
    if (image !== undefined) user.image = image;

    await user.save();

    // Send notification to partner
    if (changedFields.length > 0 && user.partnerUserId) {
      const partner = await User.findOne({ userId: user.partnerUserId });

      if (partner?.notificationToken) {
        await sendExpoPush(
          [partner.notificationToken],
          NotificationMessages.Profile.PartnerProfileUpdated,
          {
            partnerName: user.name,
            isForUser: false,
            changedFields,
          },
          {
            type: NotificationData.Profile,
            image: image ?? user.image ?? undefined,
          },
          [partner.userId]
        );
      }
    }

    res.json({
      message: "Profile updated successfully",
      user: await formatUserResponse(user),
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Update Theme
 */
router.put("/update-theme", async (req, res) => {
  try {
    const { userId, theme } = req.body || {};
    if (!userId) return res.status(400).json({ message: "userId is required" });

    if (!theme || typeof theme !== "object")
      return res.status(400).json({ message: "theme object is required" });

    const { light, dark } = theme;
    if (!light || !dark)
      return res
        .status(400)
        .json({ message: "Both light and dark colors are required" });

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.theme = { light, dark };
    await user.save();

    res.json({
      message: "Theme updated successfully",
      user: await formatUserResponse(user),
    });
  } catch (err) {
    console.error("Update theme error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Update Font
 */
router.put("/update-font", async (req, res) => {
  try {
    const { userId, font } = req.body || {};
    if (!userId) return res.status(400).json({ message: "userId is required" });

    if (!font) return res.status(400).json({ message: "font is required" });

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.font = font;
    await user.save();

    res.json({
      message: "Font updated successfully",
      user: await formatUserResponse(user),
    });
  } catch (err) {
    console.error("Update theme error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Update Password
 */
router.put("/update-password", async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body || {};
    if (!userId || !oldPassword || !newPassword)
      return res.status(400).json({
        message: "userId, oldPassword, and newPassword are required",
      });

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Old password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      message: "Password updated successfully",
      user: await formatUserResponse(user),
    });
  } catch (err) {
    console.error("Update password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Add Email to Existing User (Migration)
 */
router.put("/add-email", async (req, res) => {
  try {
    const { userId, email } = req.body || {};
    if (!userId || !email)
      return res.status(400).json({ message: "userId and email are required" });

    // Check if email already exists
    if (await User.exists({ email })) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.email) {
      return res.status(400).json({ message: "User already has an email" });
    }

    user.email = email;
    await user.save();

    res.json({
      message: "Email added successfully",
      user: await formatUserResponse(user),
    });
  } catch (err) {
    console.error("Add email error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
