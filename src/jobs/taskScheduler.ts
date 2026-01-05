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
async function getTokensForSubtask(
  ownerUserId: string,
  assignedTo: AssignedTo
) {
  const tokens: string[] = [];
  const userIds: string[] = [];
  const { owner, partner } = await getOwnerAndPartner(ownerUserId);

  if (assignedTo === AssignedTo.Me || assignedTo === AssignedTo.Both) {
    if (owner?.notificationToken) {
      tokens.push(owner.notificationToken);
      userIds.push(owner.userId);
    }
  }
  if (assignedTo === AssignedTo.Partner || assignedTo === AssignedTo.Both) {
    if (partner?.notificationToken) {
      tokens.push(partner.notificationToken);
      userIds.push(partner.userId);
    }
  }
  return { tokens, userIds };
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
          if (
            subtask.status === SubtaskStatus.Pending ||
            subtask.status === SubtaskStatus.PartiallyComplete
          ) {
            const due = new Date(subtask.dueDateTime);
            const diffMinutes = (due.getTime() - now.getTime()) / (1000 * 60);

            if (!subtask.remindersSent)
              subtask.remindersSent = new Map<string, boolean>();

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
                !subtask.remindersSent.get(key)
              ) {
                // For PartiallyComplete subtasks assigned to "Both", only notify the partner who hasn't completed
                let { tokens, userIds } = await getTokensForSubtask(
                  task.ownerUserId,
                  subtask.assignedTo as AssignedTo
                );

                if (
                  subtask.status === SubtaskStatus.PartiallyComplete &&
                  subtask.assignedTo === AssignedTo.Both
                ) {
                  // Filter out users who have already completed this subtask
                  const { owner, partner } = await getOwnerAndPartner(
                    task.ownerUserId
                  );
                  const filteredTokens: string[] = [];
                  const filteredUserIds: string[] = [];

                  if (
                    owner &&
                    !subtask.completedBy?.includes(owner.userId) &&
                    owner.notificationToken
                  ) {
                    filteredTokens.push(owner.notificationToken);
                    filteredUserIds.push(owner.userId);
                  }
                  if (
                    partner &&
                    !subtask.completedBy?.includes(partner.userId) &&
                    partner.notificationToken
                  ) {
                    filteredTokens.push(partner.notificationToken);
                    filteredUserIds.push(partner.userId);
                  }

                  tokens = filteredTokens;
                  userIds = filteredUserIds;
                }

                if (tokens.length > 0) {
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
                      userId: task.ownerUserId,
                      isActive: task.status === TaskStatus.Active,
                    },
                    userIds,
                    String(task._id)
                  );
                }

                subtask.remindersSent.set(key, true);
                updated = true;
              }
            }

            if (due < now) {
              // Handle expiration for different statuses
              if (subtask.status === SubtaskStatus.PartiallyComplete) {
                // PartiallyComplete subtasks that expire should notify incomplete partners
                const { owner, partner } = await getOwnerAndPartner(
                  task.ownerUserId
                );
                const incompleteUsers: string[] = [];

                if (owner && !subtask.completedBy?.includes(owner.userId)) {
                  incompleteUsers.push(owner.userId);
                }
                if (partner && !subtask.completedBy?.includes(partner.userId)) {
                  incompleteUsers.push(partner.userId);
                }

                // Send expiration notification to incomplete users
                if (incompleteUsers.length > 0) {
                  const tokens: string[] = [];
                  if (
                    owner &&
                    incompleteUsers.includes(owner.userId) &&
                    owner.notificationToken
                  ) {
                    tokens.push(owner.notificationToken);
                  }
                  if (
                    partner &&
                    incompleteUsers.includes(partner.userId) &&
                    partner.notificationToken
                  ) {
                    tokens.push(partner.notificationToken);
                  }

                  if (tokens.length > 0) {
                    await sendExpoPush(
                      tokens,
                      () => ({
                        title: "⏰ Subtask Expired",
                        body: `"${subtask.title}" has expired (was partially complete)`,
                      }),
                      {},
                      {
                        type: NotificationData.SubtaskReminder,
                        taskId: task._id,
                        subtaskId: subtask._id,
                        userId: task.ownerUserId,
                        isActive: task.status === TaskStatus.Active,
                      },
                      incompleteUsers,
                      String(task._id)
                    );
                  }
                }
              }

              subtask.status = SubtaskStatus.Expired;
              subtask.completedAt = due;
              // Keep completedBy array intact for audit purposes
              updated = true;
            } else {
              allDone = false;
            }
          } else if (subtask.status === SubtaskStatus.Completed) {
            // Subtask is completed - counts as "done" for task completion
          } else if (subtask.status === SubtaskStatus.Expired) {
            // Expired subtasks don't count as "done" but are "final"
            allDone = false;
          } else {
            // Any other status (shouldn't happen, but safety check)
            allDone = false;
          }
        }

        // Use the task's updateProgress method for consistent status logic
        if (updated) {
          if (typeof (task as any).updateProgress === "function") {
            (task as any).updateProgress();
          }
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
                assignedTo: st.assignedTo, // Preserve subtask assignment
                dueDateTime: due,
                status: SubtaskStatus.Pending,
                completedBy: [], // Initialize empty completedBy array for new recurring tasks
                createdBy: st.createdBy,
              };
            });

            const regenerated = new Task({
              title: task.title,
              ownerUserId: task.ownerUserId,
              createdBy: task.createdBy,
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
