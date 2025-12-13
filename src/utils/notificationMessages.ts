export const NotificationMessages = {
  Task: {
    Reminder: (props: {
      taskTitle: string;
      subtaskTitle: string;
      timeString: string;
    }) => {
      const variants = [
        `⏰⚡ Heads up! "${props.subtaskTitle}" in "${props.taskTitle}" is due in ${props.timeString}.`,
        `🚨⏳ Reminder: "${props.subtaskTitle}" under "${props.taskTitle}" will be due in ${props.timeString}.`,
        `⚡💡 Don't miss it! "${props.subtaskTitle}" in "${props.taskTitle}" is due soon—${props.timeString} left.`,
        `⏳🔥 "${props.subtaskTitle}" from "${props.taskTitle}" is almost due. Tick-tock!`,
        `📌📅 Your task "${props.taskTitle}" is calling—subtask "${props.subtaskTitle}" due in ${props.timeString}.`,
        `⚠️⏰ Alert! "${props.subtaskTitle}" in "${props.taskTitle}" is approaching deadline.`,
        `🕒✨ Time flies! "${props.subtaskTitle}" in "${props.taskTitle}" needs attention in ${props.timeString}.`,
        `💡⏱ Quick reminder: "${props.subtaskTitle}" of "${props.taskTitle}" is due soon.`,
        `🚀📌 Subtask "${props.subtaskTitle}" from "${props.taskTitle}" is pending—${props.timeString} left!`,
        `👀📝 Psst! "${props.subtaskTitle}" in "${props.taskTitle}" is due soon. Don’t forget!`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `⏳⚡ Subtask Reminder`, body };
    },

    Created: (props: {
      taskTitle: string;
      creatorName: string;
      forYou?: string;
    }) => {
      const variants = [
        `🎯✨ ${props.creatorName} created "${props.taskTitle}" ${
          props.forYou ? "just for you—go crush it!" : ""
        }`,
        `🚀📌 New task alert! "${props.taskTitle}" by ${props.creatorName} ${
          props.forYou ? "is all yours!" : ""
        }`,
        `💡🎉 "${props.taskTitle}" has been added by ${props.creatorName} ${
          props.forYou ? "just for you!" : ""
        }`,
        `⚡📅 Heads up! ${props.creatorName} added a new task: "${props.taskTitle}".`,
        `🔥📝 Task incoming: "${props.taskTitle}" created by ${props.creatorName}.`,
        `✨📌 "${props.taskTitle}" is live, thanks to ${props.creatorName}.`,
        `🎉💡 Exciting! ${props.creatorName} just added "${props.taskTitle}".`,
        `🚀⚡ New challenge: "${props.taskTitle}" from ${props.creatorName}. Are you ready?`,
        `📢👀 "${props.taskTitle}" awaits! Created by ${props.creatorName}.`,
        `⚠️💪 Alert! ${props.creatorName} added "${props.taskTitle}". Time to act.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `🎯📝 New Task Created`, body };
    },

    Updated: (props: { taskTitle: string; updaterName: string }) => {
      const variants = [
        `✏️⚡ ${props.updaterName} updated "${props.taskTitle}". Check it out!`,
        `💡🔄 "${props.taskTitle}" has some new changes from ${props.updaterName}.`,
        `🚀📝 ${props.updaterName} just tweaked "${props.taskTitle}".`,
        `⚡📢 Heads up! "${props.taskTitle}" got an update from ${props.updaterName}.`,
        `✨🖊 "${props.taskTitle}" changed. Updated by ${props.updaterName}.`,
        `💪⚡ ${props.updaterName} made edits in "${props.taskTitle}".`,
        `📌💡 Update alert: "${props.taskTitle}" modified by ${props.updaterName}.`,
        `📝👀 "${props.taskTitle}" just evolved, thanks to ${props.updaterName}.`,
        `⚠️🖊 ${props.updaterName} refreshed "${props.taskTitle}".`,
        `🔥💡 Changes detected! "${props.taskTitle}" was updated by ${props.updaterName}.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `✏️⚡ Task Updated`, body };
    },

    Deleted: (props: { taskTitle: string; ownerName: string }) => {
      const variants = [
        `❌💀 ${props.ownerName} removed "${props.taskTitle}".`,
        `🗑️⚠️ "${props.taskTitle}" was deleted by ${props.ownerName}.`,
        `💔📝 Task gone! "${props.taskTitle}" deleted by ${props.ownerName}.`,
        `💀📌 RIP "${props.taskTitle}"—deleted by ${props.ownerName}.`,
        `⚠️🗑️ "${props.taskTitle}" has vanished. Thanks, ${props.ownerName}.`,
        `🚨❌ Alert! ${props.ownerName} removed "${props.taskTitle}".`,
        `🗑️💡 "${props.taskTitle}" deleted. ${props.ownerName} took action.`,
        `💔⚡ ${props.ownerName} nuked the task "${props.taskTitle}".`,
        `⚡📝 "${props.taskTitle}" has been erased by ${props.ownerName}.`,
        `🗑️🔥 Goodbye, "${props.taskTitle}". Deleted by ${props.ownerName}.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `❌⚡ Task Deleted`, body };
    },

    SubtaskStatusChanged: (props: {
      taskTitle: string;
      actorName: string;
      status: string;
      subtaskTitle: string;
    }) => {
      const variants = [
        `✅⚡ ${props.actorName} marked "${props.subtaskTitle}" in "${props.taskTitle}" as ${props.status}.`,
        `💡📝 "${props.subtaskTitle}" in "${props.taskTitle}" is now ${props.status}, updated by ${props.actorName}.`,
        `⚡📌 Status update! "${props.subtaskTitle}" from "${props.taskTitle}" → ${props.status}.`,
        `✨💪 ${props.actorName} just changed "${props.subtaskTitle}" to ${props.status}.`,
        `🚀📝 "${props.subtaskTitle}" now has status: ${props.status} (by ${props.actorName}).`,
        `⚠️📌 ${props.actorName} updated subtask "${props.subtaskTitle}" to ${props.status}.`,
        `✅💡 "${props.subtaskTitle}" status changed to ${props.status}.`,
        `📢📝 Quick heads-up: "${props.subtaskTitle}" in "${props.taskTitle}" → ${props.status}.`,
        `💪⚡ "${props.subtaskTitle}" from "${props.taskTitle}" is ${props.status} now.`,
        `⚡👀 ${props.actorName} toggled "${props.subtaskTitle}" → ${props.status}.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `📝⚡ Subtask Status`, body };
    },

    Comment: (props: {
      taskTitle: string;
      commenterName: string;
      text: string;
    }) => {
      const cleanText = props.text?.trim();
      const truncatedText =
        cleanText && cleanText.length > 50
          ? cleanText.substring(0, 50) + "..."
          : cleanText;

      return {
        title: `💬 ${props.commenterName}`,
        body: truncatedText || `Commented on "${props.taskTitle}"`,
      };
    },

    SubtaskComment: (props: {
      taskTitle: string;
      commenterName: string;
      subtaskTitle: string;
      text: string;
    }) => {
      const cleanText = props.text?.trim();
      const truncatedText =
        cleanText && cleanText.length > 50
          ? cleanText.substring(0, 50) + "..."
          : cleanText;

      return {
        title: `💬 ${props.commenterName}`,
        body: truncatedText || `Commented on "${props.subtaskTitle}"`,
      };
    },
  },

  Profile: {
    PartnerConnected: (props: {
      userName: string;
      partnerName: string;
      isForUser?: boolean;
    }) => {
      const variants = props.isForUser
        ? [
            `🎉💜 You’re now connected with ${props.partnerName}! Exciting times!`,
            `👋✨ Say hello to ${props.partnerName}, your new connection!`,
            `🙌💡 High five! ${props.partnerName} is now in your network.`,
            `🤝🚀 Connection success! Welcome ${props.partnerName} onboard.`,
            `🎊💜 Yay! ${props.partnerName} is officially your partner.`,
            `🌟🎉 New buddy alert! ${props.partnerName} joined your connections.`,
            `🎈✨ Woohoo! You're connected with ${props.partnerName}!`,
            `💌👋 Cheers! ${props.partnerName} is now linked with you.`,
            `💜🌟 Hey! ${props.partnerName} is now part of your circle.`,
            `🌸🎉 Your network just grew! Connected with ${props.partnerName}.`,
          ]
        : [
            `👋💡 ${props.userName} has connected with you. Say hi!`,
            `🚀🎉 ${props.userName} wants to connect with you. Time to respond!`,
            `⚡🌟 Heads up! ${props.userName} added you.`,
            `💌✨ Someone new: ${props.userName} wants to connect.`,
            `🌸💬 ${props.userName} is reaching out to connect.`,
            `📢👋 Ping! ${props.userName} sent a connection request.`,
            `🎉💡 New friend incoming: ${props.userName} wants in.`,
            `⚡🌟 ${props.userName} is now trying to connect with you.`,
            `💌👀 Connection request alert: ${props.userName}.`,
            `🌸🎊 Meet ${props.userName}—they want to connect.`,
          ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `🤝💜 Connection Update`, body };
    },

    PartnerProfileUpdated: (props: {
      partnerName: string;
      changedFields: { field: string; oldValue: string; newValue: string }[];
    }) => {
      const fieldsText = props.changedFields
        .map((f) => {
          // Don't show image URLs in notification message for privacy
          if (f.field === "image") {
            return "profile picture";
          }
          // For other fields, show the change details
          return `${f.field} (${f.oldValue} → ${f.newValue})`;
        })
        .join(", ");
      const variants = [
        `✨💡 ${props.partnerName} updated their ${fieldsText}. Take a look!`,
        `🚀📝 Your partner, ${props.partnerName}, changed their ${fieldsText}.`,
        `💜⚡ Profile update: ${props.partnerName} modified ${fieldsText}.`,
        `🔔🎉 Changes spotted! ${props.partnerName} updated ${fieldsText}.`,
        `💡🌟 ${props.partnerName} made edits: ${fieldsText}.`,
        `📢✨ FYI: ${props.partnerName}'s profile now has ${fieldsText}.`,
        `⚡📝 Heads up! ${props.partnerName} updated ${fieldsText}.`,
        `🎯💜 Update alert: ${props.partnerName} changed ${fieldsText}.`,
        `🚀🌟 ${props.partnerName} refreshed their profile: ${fieldsText}.`,
        `💡🎉 Notice: ${props.partnerName} changed ${fieldsText}.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `📝💜 Profile Update`, body };
    },
  },

  List: {
    Created: (props: { listTitle: string; ownerName: string }) => {
      const variants = [
        `🗂️✨ ${props.ownerName} made a new list: "${props.listTitle}". Take a peek!`,
        `📌🎉 "${props.listTitle}" has been created by ${props.ownerName}.`,
        `🚀💡 Heads-up! New list "${props.listTitle}" added by ${props.ownerName}.`,
        `🎯📅 Fresh list alert: "${props.listTitle}" from ${props.ownerName}.`,
        `💜🔥 Exciting! ${props.ownerName} just created "${props.listTitle}".`,
        `🌟📝 New organizational gem: "${props.listTitle}" by ${props.ownerName}.`,
        `✨📌 "${props.listTitle}" is now live, thanks to ${props.ownerName}.`,
        `⚡💡 Check it out! ${props.ownerName} added "${props.listTitle}".`,
        `💬🎉 Alert! "${props.listTitle}" created by ${props.ownerName}.`,
        `🎯📢 Heads-up! ${props.ownerName} introduced "${props.listTitle}".`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `🗂️🎉 New List`, body };
    },

    Updated: (props: { listTitle: string; ownerName: string }) => {
      const variants = [
        `✏️⚡ ${props.ownerName} updated "${props.listTitle}".`,
        `💡📝 "${props.listTitle}" has some new changes from ${props.ownerName}.`,
        `🚀📌 Heads-up! "${props.listTitle}" got updated by ${props.ownerName}.`,
        `🎯💡 "${props.listTitle}" has been refreshed by ${props.ownerName}.`,
        `⚡🎉 Alert! ${props.ownerName} tweaked "${props.listTitle}".`,
        `💜📢 Check it out: "${props.listTitle}" updated by ${props.ownerName}.`,
        `📝🌟 Changes applied to "${props.listTitle}" by ${props.ownerName}.`,
        `⚡💡 ${props.ownerName} made edits in "${props.listTitle}".`,
        `🎯✨ "${props.listTitle}" has new updates from ${props.ownerName}.`,
        `💬🚀 Heads-up! ${props.ownerName} updated "${props.listTitle}".`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `✏️⚡ List Updated`, body };
    },

    Deleted: (props: { listTitle: string; ownerName: string }) => {
      const variants = [
        `❌💔 ${props.ownerName} deleted "${props.listTitle}".`,
        `🗑️⚡ "${props.listTitle}" has been removed by ${props.ownerName}.`,
        `💀📝 Heads-up! "${props.listTitle}" deleted.`,
        `🚨📌 List gone: "${props.listTitle}" by ${props.ownerName}.`,
        `💔✨ Alert! ${props.ownerName} removed "${props.listTitle}".`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `❌💡 List Removed`, body };
    },

    Pinned: (props: {
      listTitle: string;
      ownerName: string;
      pinned: boolean;
    }) => {
      const variants = [
        `📌✨ ${props.ownerName} ${props.pinned ? "pinned" : "unpinned"} "${
          props.listTitle
        }".`,
        `💡🚀 Heads-up! "${props.listTitle}" ${
          props.pinned ? "pinned" : "unpinned"
        } by ${props.ownerName}.`,
        `🎯🌟 ${props.listTitle} is now ${
          props.pinned ? "pinned" : "unpinned"
        } thanks to ${props.ownerName}.`,
        `⚡💜 Update: ${props.ownerName} ${
          props.pinned ? "pinned" : "unpinned"
        } the list "${props.listTitle}".`,
        `✨📌 "${props.listTitle}" ${props.pinned ? "pinned" : "unpinned"} by ${
          props.ownerName
        }.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `${props.pinned ? "📌 Pinned!" : "📍 Unpinned"}`, body };
    },

    Comment: (props: {
      listTitle: string;
      commenterName: string;
      text: string;
    }) => {
      const cleanText = props.text?.trim();
      const truncatedText =
        cleanText && cleanText.length > 50
          ? cleanText.substring(0, 50) + "..."
          : cleanText;

      return {
        title: `💬 ${props.commenterName}`,
        body: truncatedText || `Commented on "${props.listTitle}"`,
      };
    },

    ItemStatus: (props: {
      listTitle: string;
      ownerName: string;
      completed: boolean;
    }) => {
      const variants = [
        `✅✨ ${props.ownerName} marked an item in "${props.listTitle}" as ${
          props.completed ? "done" : "not done yet"
        }.`,
        `⚡📌 "${props.listTitle}" update: item marked ${
          props.completed ? "complete" : "incomplete"
        } by ${props.ownerName}.`,
        `🎯💡 ${props.ownerName} just updated an item in "${
          props.listTitle
        }" to ${props.completed ? "done" : "not done yet"}.`,
        `💜🚀 Status alert: ${props.ownerName} marked an item in "${
          props.listTitle
        }" as ${props.completed ? "done" : "not done yet"}.`,
        `🌟📝 Item in "${props.listTitle}" marked ${
          props.completed ? "complete" : "pending"
        } by ${props.ownerName}.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `✅💡 Item Status`, body };
    },
  },

  Note: {
    Created: (props: { noteTitle: string; ownerName: string }) => {
      const variants = [
        `📝✨ ${props.ownerName} added a new note: "${props.noteTitle}".`,
        `📌💡 Heads-up! "${props.noteTitle}" created by ${props.ownerName}.`,
        `💜🚀 Exciting! ${props.ownerName} just added "${props.noteTitle}".`,
        `🎯📝 New note alert: "${props.noteTitle}" by ${props.ownerName}.`,
        `⚡🌟 "${props.noteTitle}" is now live, thanks to ${props.ownerName}.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `📝🎉 New Note`, body };
    },

    Updated: (props: { noteTitle: string; ownerName: string }) => {
      const variants = [
        `✏️⚡ ${props.ownerName} updated "${props.noteTitle}".`,
        `💡📌 "${props.noteTitle}" has been modified by ${props.ownerName}.`,
        `🎯📝 Heads-up! "${props.noteTitle}" got refreshed by ${props.ownerName}.`,
        `🚀✨ "${props.noteTitle}" changes applied by ${props.ownerName}.`,
        `💜⚡ Update alert! ${props.ownerName} edited "${props.noteTitle}".`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `✏️💡 Note Updated`, body };
    },

    Deleted: (props: { noteTitle: string; ownerName: string }) => {
      const variants = [
        `❌💔 ${props.ownerName} removed "${props.noteTitle}".`,
        `🗑️⚡ "${props.noteTitle}" has been deleted by ${props.ownerName}.`,
        `💀📝 Heads-up! "${props.noteTitle}" deleted.`,
        `🚨📌 Note gone: "${props.noteTitle}" by ${props.ownerName}.`,
        `💔✨ Alert! ${props.ownerName} removed "${props.noteTitle}".`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `❌💡 Note Deleted`, body };
    },

    Comment: (props: {
      noteTitle: string;
      commenterName: string;
      text: string;
    }) => {
      const cleanText = props.text?.trim();
      const truncatedText =
        cleanText && cleanText.length > 50
          ? cleanText.substring(0, 50) + "..."
          : cleanText;

      return {
        title: `💬 ${props.commenterName}`,
        body: truncatedText || `Commented on "${props.noteTitle}"`,
      };
    },

    Pinned: (props: {
      noteTitle: string;
      ownerName: string;
      pinned: boolean;
    }) => {
      const variants = [
        `📌✨ ${props.ownerName} ${props.pinned ? "pinned" : "unpinned"} "${
          props.noteTitle
        }".`,
        `💡🚀 Heads-up! "${props.noteTitle}" ${
          props.pinned ? "pinned" : "unpinned"
        } by ${props.ownerName}.`,
        `🎯🌟 "${props.noteTitle}" is now ${
          props.pinned ? "pinned" : "unpinned"
        } thanks to ${props.ownerName}.`,
        `⚡💜 Update: ${props.ownerName} ${
          props.pinned ? "pinned" : "unpinned"
        } the note "${props.noteTitle}".`,
        `✨📌 "${props.noteTitle}" ${props.pinned ? "pinned" : "unpinned"} by ${
          props.ownerName
        }.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `${props.pinned ? "📌 Pinned" : "📍 Unpinned"}`, body };
    },
  },

  Video: {
    Added: (props: { videoTitle: string; ownerName: string }) => {
      const variants = [
        `🎬✨ ${props.ownerName} uploaded "${props.videoTitle}". Time to watch!`,
        `🚀💡 New video alert! "${props.videoTitle}" by ${props.ownerName}.`,
        `⚡🎉 Heads-up! "${props.videoTitle}" is live thanks to ${props.ownerName}.`,
        `🎯📽️ "${props.videoTitle}" added by ${props.ownerName}. Check it out!`,
        `💜🔥 Exciting! "${props.videoTitle}" uploaded by ${props.ownerName}.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `🎬🚀 New Video!`, body };
    },

    Deleted: (props: { videoTitle: string }) => {
      const variants = [
        `❌💔 "${props.videoTitle}" has been deleted.`,
        `🗑️⚡ Video gone: "${props.videoTitle}".`,
        `💀🎬 Heads-up! "${props.videoTitle}" removed.`,
        `🚨📝 Alert! "${props.videoTitle}" deleted.`,
        `💔📽️ "${props.videoTitle}" no longer available.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `❌💡 Video Removed`, body };
    },

    Viewed: (props: { videoTitle: string }) => {
      const variants = [
        `👀✨ Someone watched your video "${props.videoTitle}"!`,
        `🎯💡 "${props.videoTitle}" just got a new view!`,
        `⚡🚀 Heads-up! Someone checked out "${props.videoTitle}".`,
        `📢🔥 "${props.videoTitle}" was viewed recently.`,
        `💜🎬 Watch alert! "${props.videoTitle}" got a view.`,
      ];
      const body = variants[Math.floor(Math.random() * variants.length)];
      return { title: `👀💡 Video Viewed`, body };
    },

    Comment: (props: {
      videoTitle: string;
      commenterName: string;
      text: string;
    }) => {
      const cleanText = props.text?.trim();
      const truncatedText =
        cleanText && cleanText.length > 50
          ? cleanText.substring(0, 50) + "..."
          : cleanText;

      return {
        title: `💬 ${props.commenterName}`,
        body: truncatedText || `Commented on "${props.videoTitle}"`,
      };
    },
  },
};
