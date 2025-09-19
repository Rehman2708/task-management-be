import { Router } from "express";
import Token from "../models/Token.js";
import fetch from "node-fetch";
const router = Router();
router.post("/register", async (req, res) => {
  const { owner, token } = req.body || {};
  if (!owner || !token) return res.status(400).json({ error: "Missing" });
  await Token.findOneAndUpdate({ owner }, { token }, { upsert: true });
  res.json({ ok: true });
});
export default router;
