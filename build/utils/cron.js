import cron from "node-cron";
import Task from "../models/Task.js";
import Token from "../models/Token.js";
import { sendExpoPush } from "../routes/tokenRoutes.js";
export function initCron() {
    cron.schedule("5 0 * * *", async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 7);
            const tasks = await Task.find({
                "template.recurrence": { $ne: "One-time" },
                "template.active": true,
            }).lean();
            for (const t of tasks) {
                for (let d = new Date(today); d <= tomorrow; d.setDate(d.getDate() + 1)) {
                    let shouldCreate = false;
                    if (["Daily", "UntilOff"].includes(t.template.recurrence))
                        shouldCreate = true;
                    if (t.template.recurrence === "Weekly" &&
                        d.getDay() === new Date(t.createdAt).getDay())
                        shouldCreate = true;
                    if (t.template.recurrence === "Monthly" &&
                        d.getDate() === new Date(t.createdAt).getDate())
                        shouldCreate = true;
                    if (shouldCreate) {
                        const hhmm = t.template.defaultTimeHHMM || "09:00";
                        const [hh, mm] = hhmm.split(":").map((n) => Number(n));
                        const due = new Date(d);
                        due.setHours(hh, mm, 0, 0);
                        const exists = (t.instances || []).some((i) => new Date(i.dueDateTime).toDateString() === due.toDateString());
                        if (!exists) {
                            await Task.findByIdAndUpdate(t._id, {
                                $push: {
                                    instances: {
                                        dueDateTime: due,
                                        status: "Pending",
                                        subtasks: t.template.subtasks || [],
                                    },
                                },
                                $set: { nextDue: due },
                            });
                        }
                    }
                }
            }
        }
        catch (e) {
            console.error("[CRON ERROR]", e);
        }
    }, { timezone: process.env.TIMEZONE || "Asia/Kolkata" });
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();
            const later = new Date(now.getTime() + 15 * 60 * 1000);
            const tasks = await Task.find({
                nextDue: { $gte: now, $lte: later },
            }).lean();
            for (const t of tasks) {
                const tokens = [];
                if (t.assignedTo === "Me" || t.assignedTo === "Both") {
                    const me = await Token.findOne({ owner: "Me" });
                    if (me)
                        tokens.push(me.token);
                }
                if (t.assignedTo === "Partner" || t.assignedTo === "Both") {
                    const p = await Token.findOne({ owner: "Partner" });
                    if (p)
                        tokens.push(p.token);
                }
                for (const tok of tokens) {
                    try {
                        await sendExpoPush(tok, `Upcoming: ${t.title}`, `Due at ${new Date(t.nextDue).toLocaleString()}`, { taskId: t._id.toString() });
                    }
                    catch (e) { }
                }
            }
        }
        catch (e) {
            console.error("[CRON REMIND ERROR]", e);
        }
    }, { timezone: process.env.TIMEZONE || "Asia/Kolkata" });
}
