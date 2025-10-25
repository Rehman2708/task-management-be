import { Router } from "express";
import User, { IUserDocument, IUser } from "../models/User.js";
import { sendExpoPush } from "./notifications.js";

const router = Router();

interface UserResponse {
  userId: string;
  name: string;
  partner: {
    userId: string;
    name: string;
    image: string | null;
    theme: { light: string; dark: string };
  } | null;
  createdAt: Date;
  updatedAt: Date;
  image: string | null;
  theme: { light: string; dark: string };
}

async function formatUserResponse(
  u: IUserDocument | (IUser & { _id?: any }) | null
): Promise<UserResponse | null> {
  if (!u) return null;

  let partner: IUser | null = null;
  if (u.partnerUserId) {
    partner = await User.findOne({
      userId: u.partnerUserId,
    }).lean<IUser | null>();
  }

  return {
    userId: u.userId,
    name: u.name,
    partner: partner
      ? {
          userId: partner.userId,
          name: partner.name,
          image: partner.image ?? "",
          theme: partner.theme ?? null,
        }
      : null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    image: u.image ?? null,
    theme: u.theme ?? null,
  };
}

/**
 * 🟢 Register API
 */
router.post("/register", async (req, res) => {
  try {
    const { name, userId, partnerUserId, password, notificationToken } =
      req.body || {};

    if (!name || !userId || !password) {
      return res
        .status(400)
        .json({ message: "name, userId, and password are required" });
    }

    const existing = await User.findOne({ userId });
    if (existing) {
      return res.status(409).json({ message: "User already exists" });
    }

    let partner = null;
    if (partnerUserId) {
      partner = await User.findOne({ userId: partnerUserId });
      if (!partner) {
        return res.status(400).json({ message: "Partner userId not found" });
      }
    }

    const newUser = await User.create({
      name,
      userId,
      partnerUserId: partner ? partner.userId : null,
      password,
      notificationToken,
    });

    if (partner) {
      partner.partnerUserId = newUser.userId;
      await partner.save();
    }

    res.status(201).json({
      message: "User registered successfully",
      user: await formatUserResponse(newUser),
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Login API
 */
router.post("/login", async (req, res) => {
  try {
    const { userId, password, notificationToken } = req.body || {};

    if (!userId || !password) {
      return res
        .status(400)
        .json({ message: "userId and password are required" });
    }

    const u = await User.findOne({ userId, password });
    if (!u) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (notificationToken) {
      u.notificationToken = notificationToken;
      await u.save();
    }
    res.json({
      message: "Login successful",
      user: await formatUserResponse(u),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Connect Partner API
 */
router.post("/connect-partner", async (req, res) => {
  try {
    const { userId, partnerUserId } = req.body || {};

    if (!userId || !partnerUserId) {
      return res
        .status(400)
        .json({ message: "userId and partnerUserId are required" });
    }

    const user = await User.findOne({ userId });
    const partner = await User.findOne({ userId: partnerUserId });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    // ✅ NEW: Check if either is already connected
    if (user.partnerUserId) {
      return res
        .status(400)
        .json({ message: "This user is already connected to someone else" });
    }
    if (partner.partnerUserId) {
      return res.status(400).json({
        message: "The partner user is already connected to someone else",
      });
    }

    user.partnerUserId = partner.userId;
    partner.partnerUserId = user.userId;

    await user.save();
    await partner.save();
    if (user?.notificationToken) {
      await sendExpoPush(
        [user.notificationToken],
        `Partner Connected ❤️`,
        `You are connected with ${partner.name}🎉!`,
        { type: "profile" },
        [userId]
      );
    }
    if (partner?.notificationToken) {
      await sendExpoPush(
        [partner.notificationToken],
        `Partner Connected ❤️`,
        `${user.name} connected with you🎉!`,
        { type: "profile" },
        [partnerUserId]
      );
    }
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
 * 🟢 Get User Details API
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const u = await User.findOne({ userId });

    if (!u) return res.status(404).json({ message: "User not found" });

    res.json({
      message: "User details fetched successfully",
      user: await formatUserResponse(u),
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Logout API (Clear Notification Token)
 */
router.post("/logout", async (req, res) => {
  try {
    const { userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const u = await User.findOne({ userId });
    if (!u) {
      return res.status(404).json({ message: "User not found" });
    }

    u.notificationToken = null;
    await u.save();

    res.json({
      message: "Logout successful, notification token cleared",
      user: await formatUserResponse(u),
    });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Update Profile API
 */
router.put("/update-profile", async (req, res) => {
  try {
    const { userId, name, image } = req.body || {};

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const u = await User.findOne({ userId });
    if (!u) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) u.name = name;
    if (image !== undefined) u.image = image;

    await u.save();

    res.json({
      message: "Profile updated successfully",
      user: await formatUserResponse(u),
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * 🟢 Update Theme API
 */
router.put("/update-theme", async (req, res) => {
  try {
    const { userId, theme } = req.body || {};

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!theme || typeof theme !== "object") {
      return res.status(400).json({ message: "theme object is required" });
    }

    const { light, dark } = theme;
    if (!light || !dark) {
      return res.status(400).json({ message: "Both color required" });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (light) user.theme.light = light;
    if (dark) user.theme.dark = dark;

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
 * 🟢 Update Password API
 */
router.put("/update-password", async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body || {};

    if (!userId || !oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "userId, oldPassword, and newPassword are required" });
    }

    const u = await User.findOne({ userId });
    if (!u) {
      return res.status(404).json({ message: "User not found" });
    }

    if (u.password !== oldPassword) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    u.password = newPassword;
    await u.save();

    res.json({
      message: "Password updated successfully",
      user: await formatUserResponse(u),
    });
  } catch (err) {
    console.error("Update password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
