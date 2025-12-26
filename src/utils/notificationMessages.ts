export const NotificationMessages = {
  Task: {
    Reminder: (props: {
      taskTitle: string;
      subtaskTitle: string;
      timeString: string;
    }) => {
      return {
        title: "⏰ Subtask Reminder",
        body: `"${props.subtaskTitle}" is due in ${props.timeString}`,
      };
    },

    Created: (props: {
      taskTitle: string;
      creatorName: string;
      forYou?: string;
    }) => {
      return {
        title: "📝 New Task",
        body: `${props.creatorName} created "${props.taskTitle}"${
          props.forYou ? " for you" : ""
        }`,
      };
    },

    Updated: (props: { taskTitle: string; updaterName: string }) => {
      return {
        title: "✏️ Task Updated",
        body: `${props.updaterName} updated "${props.taskTitle}"`,
      };
    },

    Deleted: (props: { taskTitle: string; ownerName: string }) => {
      return {
        title: "🗑️ Task Deleted",
        body: `${props.ownerName} deleted "${props.taskTitle}"`,
      };
    },

    SubtaskStatusChanged: (props: {
      taskTitle: string;
      actorName: string;
      status: string;
      subtaskTitle: string;
    }) => {
      return {
        title: "✅ Subtask Status",
        body: `${props.actorName} marked "${props.subtaskTitle}" as ${props.status}`,
      };
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
      return {
        title: "🤝 Connection",
        body: props.isForUser
          ? `You're now connected with ${props.partnerName}`
          : `${props.userName} wants to connect with you`,
      };
    },

    PartnerProfileUpdated: (props: {
      partnerName: string;
      changedFields: { field: string; oldValue: string; newValue: string }[];
    }) => {
      const fieldsText = props.changedFields
        .map((f) => {
          if (f.field === "image") {
            return "profile picture";
          }
          return f.field;
        })
        .join(", ");

      return {
        title: "👤 Profile Updated",
        body: `${props.partnerName} updated their ${fieldsText}`,
      };
    },
  },

  List: {
    Created: (props: { listTitle: string; ownerName: string }) => {
      return {
        title: "📋 New List",
        body: `${props.ownerName} created "${props.listTitle}"`,
      };
    },

    Updated: (props: { listTitle: string; ownerName: string }) => {
      return {
        title: "✏️ List Updated",
        body: `${props.ownerName} updated "${props.listTitle}"`,
      };
    },

    Deleted: (props: { listTitle: string; ownerName: string }) => {
      return {
        title: "🗑️ List Deleted",
        body: `${props.ownerName} deleted "${props.listTitle}"`,
      };
    },

    Pinned: (props: {
      listTitle: string;
      ownerName: string;
      pinned: boolean;
    }) => {
      return {
        title: props.pinned ? "📌 List Pinned" : "📍 List Unpinned",
        body: `${props.ownerName} ${props.pinned ? "pinned" : "unpinned"} "${
          props.listTitle
        }"`,
      };
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
      return {
        title: "✅ Item Status",
        body: `${props.ownerName} marked an item in "${props.listTitle}" as ${
          props.completed ? "completed" : "pending"
        }`,
      };
    },
  },

  Note: {
    Created: (props: { noteTitle: string; ownerName: string }) => {
      return {
        title: "📝 New Note",
        body: `${props.ownerName} created "${props.noteTitle}"`,
      };
    },

    Updated: (props: { noteTitle: string; ownerName: string }) => {
      return {
        title: "✏️ Note Updated",
        body: `${props.ownerName} updated "${props.noteTitle}"`,
      };
    },

    Deleted: (props: { noteTitle: string; ownerName: string }) => {
      return {
        title: "🗑️ Note Deleted",
        body: `${props.ownerName} deleted "${props.noteTitle}"`,
      };
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
      return {
        title: props.pinned ? "📌 Note Pinned" : "📍 Note Unpinned",
        body: `${props.ownerName} ${props.pinned ? "pinned" : "unpinned"} "${
          props.noteTitle
        }"`,
      };
    },
  },

  Video: {
    Added: (props: { videoTitle: string; ownerName: string }) => {
      return {
        title: "🎬 New Video",
        body: `${props.ownerName} uploaded "${props.videoTitle}"`,
      };
    },

    Deleted: (props: { videoTitle: string }) => {
      return {
        title: "🗑️ Video Deleted",
        body: `"${props.videoTitle}" has been deleted`,
      };
    },

    Viewed: (props: { videoTitle: string }) => {
      return {
        title: "👀 Video Viewed",
        body: `Someone watched "${props.videoTitle}"`,
      };
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
