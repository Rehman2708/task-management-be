import { Router } from "express";
import Token from "../models/Token.js";
import fetch from "node-fetch";
const router = Router();
router.post("/register", async (req, res) => {
    const { owner, token } = req.body || {};
    if (!owner || !token)
        return res.status(400).json({ error: "Missing" });
    await Token.findOneAndUpdate({ owner }, { token }, { upsert: true });
    res.json({ ok: true });
});
export async function sendExpoPush(expoToken, title, body, data = {}) {
    const message = { to: expoToken, sound: "default", title, body, data };
    await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
    });
}
export default router;
