import { Router } from "express";
const router = Router();
/**
 * 🟢 Keep Alive API
 * Used for uptime monitoring (e.g., by cron job or uptime robot)
 */
router.get("/keep-alive", (req, res) => {
    res
        .status(200)
        .json({ message: "Server is alive 🚀", timestamp: new Date() });
});
export default router;
