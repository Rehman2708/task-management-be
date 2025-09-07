import cron from "node-cron";
import Task from "../models/Task.js";
import Token from "../models/Token.js";
import { sendExpoPush } from "../routes/notification.js";
import { AssignedTo, Frequency, SubtaskStatus, TaskStatus, } from "../enum/task.js";
// Helper to get tokens for assignment
async function getTokens(assignedTo) {
    const tokens = [];
    if (assignedTo === AssignedTo.Me || assignedTo === AssignedTo.Both) {
        const me = await Token.findOne({ owner: AssignedTo.Me });
        if (me?.token)
            tokens.push(me.token);
    }
    if (assignedTo === AssignedTo.Partner || assignedTo === AssignedTo.Both) {
        const partner = await Token.findOne({ owner: AssignedTo.Partner });
        if (partner?.token)
            tokens.push(partner.token);
    }
    return tokens;
}
// Main cron job function
export function initCron() {
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();
            const tasks = await Task.find({ status: TaskStatus.Active });
            for (const task of tasks) {
                let updated = false;
                let allDone = true;
                let allExpired = true;
                for (const subtask of task.subtasks) {
                    if (subtask.status === SubtaskStatus.Pending) {
                        const due = new Date(subtask.dueDateTime);
                        const diffSeconds = (due.getTime() - now.getTime()) / 1000;
                        // ⏰ Send reminders
                        if ([86400, 7200, 1800].includes(Math.round(diffSeconds))) {
                            const tokens = await getTokens(task.assignedTo);
                            for (const tkn of tokens) {
                                await sendExpoPush(tkn, `Reminder: ${task.title}`, `Subtask "${subtask.title}" is due at ${due.toLocaleString()}`);
                            }
                        }
                        // ❌ Expire if overdue
                        if (due < now) {
                            subtask.status = SubtaskStatus.Expired;
                            subtask.completedAt = due;
                            updated = true;
                        }
                        else {
                            allExpired = false;
                            allDone = false;
                        }
                    }
                    else if (subtask.status === SubtaskStatus.Completed) {
                        allExpired = false;
                    }
                    else {
                        allDone = false;
                    }
                }
                // ✅ Update task status
                if (allDone) {
                    task.status = TaskStatus.Completed;
                    updated = true;
                }
                else if (allExpired) {
                    task.status = TaskStatus.Expired;
                    updated = true;
                }
                if (updated) {
                    await task.save();
                    // 🔄 Regenerate recurring tasks
                    if ([Frequency.Daily, Frequency.Weekly].includes(task.frequency)) {
                        const newSubtasks = task.subtasks.map((st) => {
                            const due = new Date(st.dueDateTime);
                            if (task.frequency === Frequency.Daily)
                                due.setDate(due.getDate() + 1);
                            if (task.frequency === Frequency.Weekly)
                                due.setDate(due.getDate() + 7);
                            return {
                                title: st.title,
                                dueDateTime: due,
                                status: SubtaskStatus.Pending,
                                createdBy: st.createdBy,
                            };
                        });
                        const regenerated = new Task({
                            title: task.title,
                            assignedTo: task.assignedTo,
                            frequency: task.frequency,
                            subtasks: newSubtasks,
                            status: TaskStatus.Active,
                        });
                        await regenerated.save();
                    }
                }
            }
        }
        catch (err) {
            console.error("Cron job error:", err);
        }
    });
    console.log("Task scheduler cron job started");
}
