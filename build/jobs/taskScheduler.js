import cron from "node-cron";
import Task from "../models/Task.js";
import { AssignedTo, Frequency, SubtaskStatus, TaskStatus, } from "../enum/task.js";
import { sendExpoPush } from "../routes/notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import { NotificationMessages } from "../utils/notificationMessages.js";
// Helper to get tokens for assignment
async function getTokens(user, assignedTo) {
    const tokens = [];
    const { owner, partner } = await getOwnerAndPartner(user);
    if (assignedTo === AssignedTo.Me || assignedTo === AssignedTo.Both) {
        if (owner?.notificationToken)
            tokens.push(owner.notificationToken);
    }
    if (assignedTo === AssignedTo.Partner || assignedTo === AssignedTo.Both) {
        if (partner?.notificationToken)
            tokens.push(partner.notificationToken);
    }
    return tokens;
}
// Convert minutes to a human-readable string
function formatTime(minutes) {
    const rounded = Math.round(minutes);
    const hr = Math.floor(rounded / 60);
    let min = rounded % 60;
    if (min === 60) {
        min = 0;
        return `${hr + 1} hr${hr + 1 > 1 ? "s" : ""}`;
    }
    if (hr > 0) {
        const hrLabel = `hr${hr > 1 ? "s" : ""}`;
        const minLabel = `min${min > 1 ? "s" : ""}`;
        return min > 0 ? `${hr} ${hrLabel} ${min} ${minLabel}` : `${hr} ${hrLabel}`;
    }
    const minLabel = `min${rounded > 1 ? "s" : ""}`;
    return `${rounded} ${minLabel}`;
}
// Main cron job function
export function initCron() {
    cron.schedule("*/5 * * * *", async () => {
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
                        const diffMinutes = (due.getTime() - now.getTime()) / (1000 * 60);
                        if (!subtask.remindersSent)
                            subtask.remindersSent = new Map();
                        const reminders = [
                            { time: 180, range: [179, 181] }, // 3 hr
                            { time: 60, range: [59, 61] }, // 1 hr
                            { time: 20, range: [19, 21] }, // 20 min
                        ];
                        for (const r of reminders) {
                            const key = r.time.toString();
                            if (diffMinutes >= r.range[0] &&
                                diffMinutes <= r.range[1] &&
                                !subtask.remindersSent.get(key)) {
                                const tokens = await getTokens(task.createdBy, task.assignedTo);
                                const timeString = formatTime(diffMinutes);
                                await sendExpoPush(tokens, NotificationMessages.Task.Reminder, {
                                    taskTitle: task.title,
                                    subtaskTitle: subtask.title,
                                    timeString: timeString,
                                }, {
                                    type: "subtask_reminder",
                                    taskId: task._id,
                                    subtaskId: subtask._id,
                                    userId: task.createdBy,
                                    isActive: task.status === TaskStatus.Active,
                                }, [], String(task._id));
                                subtask.remindersSent.set(key, true);
                                updated = true;
                            }
                        }
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
                    // Regenerate recurring tasks
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
}
