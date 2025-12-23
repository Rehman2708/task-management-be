import cron from "node-cron";
import Task from "../models/Task.js";
import {
  AssignedTo,
  Frequency,
  SubtaskStatus,
  TaskStatus,
} from "../enum/task.js";
import { sendExpoPush } from "../routes/notifications.js";
import { getOwnerAndPartner } from "../helper.js";
import { NotificationData } from "../enum/notification.js";
import { NotificationMessages } from "../utils/notificationMessages.js";

// Helper to get tokens for assignment
async function getTokens(user: string, assignedTo: AssignedTo) {
  const tokens: string[] = [];
  const { owner, partner } = await getOwnerAndPartner(user);
  if (assignedTo === AssignedTo.Me || assignedTo === AssignedTo.Both) {
    if (owner?.notificationToken) tokens.push(owner.notificationToken);
  }
  if (assignedTo === AssignedTo.Partner || assignedTo === AssignedTo.Both) {
    if (partner?.notificationToken) tokens.push(partner.notificationToken);
  }
  return tokens;
}

// Convert minutes to a human-readable string
function formatTime(minutes: number): string {
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

// Main cron job function - OPTIMIZED
export function initCron() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const now = new Date();
      const threeDaysFromNow = new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000
      );

      // Optimized query: only get tasks with upcoming due dates
      const tasks = await Task.find({
        status: TaskStatus.Active,
        "subtasks.dueDateTime": { $lte: threeDaysFromNow }, // Only tasks with subtasks due within 3 days
      }).lean(); // Use lean for better performance

      // Process tasks in batches of 50 for better performance
      const batchSize = 50;
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);

        // Process batch in parallel
        await Promise.all(
          batch.map(async (task) => {
            let updated = false;
            let allDone = true;
            let allExpired = true;

            for (const subtask of task.subtasks) {
              if (subtask.status === SubtaskStatus.Pending) {
                const due = new Date(subtask.dueDateTime);
                const diffMinutes =
                  (due.getTime() - now.getTime()) / (1000 * 60);

                if (!subtask.remindersSent) subtask.remindersSent = {} as any;

                const reminders = [
                  { time: 180, range: [179, 181] }, // 3 hr
                  { time: 60, range: [59, 61] }, // 1 hr
                  { time: 20, range: [19, 21] }, // 20 min
                ];

                for (const r of reminders) {
                  const key = r.time.toString();

                  if (
                    diffMinutes >= r.range[0] &&
                    diffMinutes <= r.range[1] &&
                    !subtask.remindersSent[key]
                  ) {
                    const tokens = await getTokens(
                      task.createdBy,
                      task.assignedTo as AssignedTo
                    );

                    const timeString = formatTime(diffMinutes);

                    await sendExpoPush(
                      tokens,
                      NotificationMessages.Task.Reminder,
                      {
                        taskTitle: task.title,
                        subtaskTitle: subtask.title,
                        timeString: timeString,
                      },
                      {
                        type: NotificationData.SubtaskReminder,
                        taskId: task._id,
                        subtaskId: subtask._id,
                        userId: task.createdBy,
                        isActive: task.status === TaskStatus.Active,
                      },
                      [],
                      String(task._id)
                    );

                    subtask.remindersSent[key] = true;
                    updated = true;
                  }
                }

                if (due < now) {
                  subtask.status = SubtaskStatus.Expired;
                  subtask.completedAt = due;
                  updated = true;
                } else {
                  allDone = false;
                }
              } else if (subtask.status === SubtaskStatus.Completed) {
                // Subtask is completed - still counts as "done" for task completion
              } else {
                // Any other status means task is not fully done
                allDone = false;
              }
            }

            // Only update database if something changed
            if (updated) {
              await Task.findByIdAndUpdate(
                task._id,
                {
                  $set: {
                    subtasks: task.subtasks,
                  },
                },
                { new: false } // Don't return the document for better performance
              );

              // Regenerate recurring tasks
              if (
                [Frequency.Daily, Frequency.Weekly].includes(
                  task.frequency as Frequency
                )
              ) {
                const newSubtasks = task.subtasks.map((st: any) => {
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
          })
        );
      }

      console.log(`Processed ${tasks.length} active tasks in batches`);
    } catch (err) {
      console.error("Cron job error:", err);
    }
  });
}
