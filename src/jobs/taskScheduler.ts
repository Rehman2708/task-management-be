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
  if (minutes >= 60) {
    const hr = Math.floor(minutes / 60);
    const min = Math.round(minutes % 60);
    return min > 0 ? `${hr} hr ${min} min` : `${hr} hr`;
  }
  return `${Math.round(minutes)} min`;
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
              subtask.remindersSent = new Map<string, boolean>();

            const reminders = [
              { time: 360, range: [358, 362] }, // 6 hr
              { time: 120, range: [118, 122] }, // 2 hr
              { time: 30, range: [28, 32] }, // 30 min
              { time: 10, range: [8, 12] }, // 10 min
            ];

            for (const r of reminders) {
              const key = r.time.toString();

              if (
                diffMinutes >= r.range[0] &&
                diffMinutes <= r.range[1] &&
                !subtask.remindersSent.get(key)
              ) {
                const tokens = await getTokens(
                  task.createdBy,
                  task.assignedTo as AssignedTo
                );

                const timeString = formatTime(diffMinutes);

                await sendExpoPush(
                  tokens,
                  `Reminder: ${task.title}`,
                  `Subtask "${subtask.title}" is due in approximately ${timeString}.`,
                  {
                    type: NotificationData.Task,
                    taskId: task._id,
                    isActive: task.status === TaskStatus.Active,
                  },
                  [],
                  String(task._id)
                );

                subtask.remindersSent.set(key, true);
                updated = true;
              }
            }

            if (due < now) {
              subtask.status = SubtaskStatus.Expired;
              subtask.completedAt = due;
              updated = true;
            } else {
              allExpired = false;
              allDone = false;
            }
          } else if (subtask.status === SubtaskStatus.Completed) {
            allExpired = false;
          } else {
            allDone = false;
          }
        }

        if (allDone) {
          task.status = TaskStatus.Completed;
          updated = true;
        } else if (allExpired) {
          task.status = TaskStatus.Expired;
          updated = true;
        }

        if (updated) {
          await task.save();

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
      }
    } catch (err) {
      console.error("Cron job error:", err);
    }
  });
}
