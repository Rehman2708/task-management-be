import { Router } from "express";
import User, { IUserDocument, IUser } from "../models/User.js";
import { sendExpoPush } from "./notifications.js";
import { NotificationData } from "../enum/notification.js";
import { NotificationMessages } from "../utils/notificationMessages.js";

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
 * 🟢 Register
 */
router.post("/register", async (req, res) => {
  try {
    const { name, userId, partnerUserId, password, notificationToken } =
      req.body || {};

    if (!name || !userId || !password)
      return res
        .status(400)
        .json({ message: "name, userId, and password are required" });

    if (await User.exists({ userId }))
      return res.status(409).json({ message: "User already exists" });

    let partner = null;
    if (partnerUserId) {
      partner = await User.findOne({ userId: partnerUserId });
      if (!partner)
        return res.status(400).json({ message: "Partner userId not found" });
    }

    const newUser = await User.create({
      name,
      userId,
      password,
      notificationToken,
      partnerUserId: partner?.userId ?? null,
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
 * 🟢 Login
 */
router.post("/login", async (req, res) => {
  try {
    const { userId, password, notificationToken } = req.body || {};

    if (!userId || !password)
      return res
        .status(400)
        .json({ message: "userId and password are required" });

    const user = await User.findOne({ userId, password });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

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

    const nameChanged = name && name !== user.name;
    const imageChanged = image !== undefined && image !== user.image;

    if (name) user.name = name;
    if (about) user.about = about;
    if (image !== undefined) user.image = image;
    await user.save();

    // Notify partner if name or image changed and partner exists
    if ((nameChanged || imageChanged) && user.partnerUserId) {
      const partner = await User.findOne({ userId: user.partnerUserId });
      if (partner?.notificationToken) {
        await sendExpoPush(
          [partner.notificationToken],
          NotificationMessages.Profile.PartnerProfileUpdated,
          {
            partnerName: user.name,
            isForUser: false,
            changedFields: [
              ...(nameChanged ? ["name"] : []),
              ...(imageChanged ? ["image"] : []),
            ],
          },
          { type: NotificationData.Profile },
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

    if (user.password !== oldPassword)
      return res.status(401).json({ message: "Old password is incorrect" });

    user.password = newPassword;
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

export default router;
