import { Router } from "express";
import User, { IUserDocument, IUser } from "../models/User.js";

const router = Router();

interface UserResponse {
  userId: string;
  name: string;
  partner: { userId: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
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
    partner: partner ? { userId: partner.userId, name: partner.name } : null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/**
 * 🟢 Register API
 */
router.post("/register", async (req, res) => {
  try {
    const { name, userId, partnerUserId, password } = req.body || {};

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
    const { userId, password } = req.body || {};

    if (!userId || !password) {
      return res
        .status(400)
        .json({ message: "userId and password are required" });
    }

    const u = await User.findOne({ userId, password });
    if (!u) {
      return res.status(401).json({ message: "Invalid credentials" });
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

    user.partnerUserId = partner.userId;
    partner.partnerUserId = user.userId;

    await user.save();
    await partner.save();

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

export default router;
