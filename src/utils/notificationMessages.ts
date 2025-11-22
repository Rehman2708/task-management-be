export const NotificationMessages = {
  Task: {
    Reminder: (props: {
      taskTitle: string;
      subtaskTitle: string;
      timeString: string;
    }) => ({
      title: `Upcoming Subtask Reminder ⏰`,
      body: `The subtask "${props.subtaskTitle}" in task "${props.taskTitle}" is due in approximately ${props.timeString}.`,
    }),

    Created: (props: {
      taskTitle: string;
      creatorName: string;
      forYou?: string;
    }) => ({
      title: `New Task Assigned ✅`,
      body: `${props.creatorName} created a new task "${props.taskTitle}" ${
        props.forYou ? "for you" : ""
      }.`,
    }),

    Updated: (props: { taskTitle: string; updaterName: string }) => ({
      title: `Task Updated ✏️`,
      body: `${props.updaterName} has updated the task "${props.taskTitle}".`,
    }),

    Deleted: (props: { taskTitle: string; ownerName: string }) => ({
      title: `Task Removed ❌`,
      body: `${props.ownerName} has deleted the task "${props.taskTitle}".`,
    }),

    SubtaskStatusChanged: (props: {
      taskTitle: string;
      actorName: string;
      status: string;
      subtaskTitle: string;
    }) => ({
      title: `Subtask Status Updated 📝`,
      body: `${props.actorName} marked "${props.subtaskTitle}" in task "${props.taskTitle}" as ${props.status}.`,
    }),

    Comment: (props: {
      taskTitle: string;
      commenterName: string;
      text: string;
    }) => ({
      title: `New Comment on Task 💬`,
      body: `${props.commenterName} commented on "${props.taskTitle}": "${props.text}"`,
    }),

    SubtaskComment: (props: {
      taskTitle: string;
      commenterName: string;
      subtaskTitle: string;
      text: string;
    }) => ({
      title: `New Comment on Subtask 💬`,
      body: `${props.commenterName} commented on "${props.subtaskTitle}" in task "${props.taskTitle}": "${props.text}"`,
    }),
  },

  Profile: {
    PartnerConnected: (props: {
      userName: string;
      partnerName: string;
      isForUser?: boolean;
    }) => ({
      title: `Partner Connection Established 🤝`,
      body: props.isForUser
        ? `You are now connected with ${props.partnerName}.`
        : `${props.userName} has connected with you.`,
    }),
  },

  List: {
    Created: (props: { listTitle: string; ownerName: string }) => ({
      title: `New List Created 🗂️`,
      body: `${props.ownerName} created a new list titled "${props.listTitle}".`,
    }),

    Updated: (props: { listTitle: string; ownerName: string }) => ({
      title: `List Updated ✏️`,
      body: `${props.ownerName} updated the list "${props.listTitle}".`,
    }),

    Deleted: (props: { listTitle: string; ownerName: string }) => ({
      title: `List Deleted ❌`,
      body: `${props.ownerName} deleted the list "${props.listTitle}".`,
    }),

    Pinned: (props: {
      listTitle: string;
      ownerName: string;
      pinned: boolean;
    }) => ({
      title: `List ${props.pinned ? "Pinned 📌" : "Unpinned 📌"}`,
      body: `${props.ownerName} ${
        props.pinned ? "pinned" : "unpinned"
      } the list "${props.listTitle}".`,
    }),
    Comment: (props: {
      listTitle: string;
      commenterName: string;
      text: string;
    }) => ({
      title: `New Comment on List 💬`,
      body: `${props.commenterName} commented on "${props.listTitle}": "${props.text}"`,
    }),
    ItemStatus: (props: {
      listTitle: string;
      ownerName: string;
      completed: boolean;
    }) => ({
      title: `List Item Status Updated ✅`,
      body: `${props.ownerName} marked an item in the list "${
        props.listTitle
      }" as ${props.completed ? "completed" : "incomplete"}.`,
    }),
  },

  Note: {
    Created: (props: { noteTitle: string; ownerName: string }) => ({
      title: `New Note Added 📝`,
      body: `${props.ownerName} added a new note titled "${props.noteTitle}".`,
    }),

    Updated: (props: { noteTitle: string; ownerName: string }) => ({
      title: `Note Updated ✏️`,
      body: `${props.ownerName} updated the note "${props.noteTitle}".`,
    }),

    Deleted: (props: { noteTitle: string; ownerName: string }) => ({
      title: `Note Deleted ❌`,
      body: `${props.ownerName} deleted the note "${props.noteTitle}".`,
    }),
    Comment: (props: {
      noteTitle: string;
      commenterName: string;
      text: string;
    }) => ({
      title: `New Comment on Note 💬`,
      body: `${props.commenterName} commented on "${props.noteTitle}": "${props.text}"`,
    }),
    Pinned: (props: {
      noteTitle: string;
      ownerName: string;
      pinned: boolean;
    }) => ({
      title: `Note ${props.pinned ? "Pinned 📌" : "Unpinned 📌"}`,
      body: `${props.ownerName} ${
        props.pinned ? "pinned" : "unpinned"
      } the note "${props.noteTitle}".`,
    }),
  },

  Video: {
    Added: (props: { videoTitle: string; ownerName: string }) => ({
      title: `New Video Added 🎥`,
      body: `${props.ownerName} added a new video titled "${props.videoTitle}".`,
    }),

    Deleted: (props: { videoTitle: string }) => ({
      title: `Video Removed ❌`,
      body: `The video "${props.videoTitle}" has been deleted.`,
    }),

    Viewed: (props: { videoTitle: string }) => ({
      title: `Video Viewed ✅`,
      body: `Your video "${props.videoTitle}" has been viewed.`,
    }),

    Comment: (props: {
      videoTitle: string;
      commenterName: string;
      text: string;
    }) => ({
      title: `New Comment on Video 💬`,
      body: `${props.commenterName} commented on "${props.videoTitle}": "${props.text}"`,
    }),
  },
};
