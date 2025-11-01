export const NotificationMessages = {
    Task: {
        Reminder: (props) => ({
            title: `Upcoming Subtask Reminder ⏰`,
            body: `The subtask "${props.subtaskTitle}" in task "${props.taskTitle}" is due in approximately ${props.timeString}.`,
        }),
        Created: (props) => ({
            title: `New Task Assigned ✅`,
            body: `${props.creatorName} created a new task "${props.taskTitle}" ${props.forYou ? "for you" : ""}.`,
        }),
        Updated: (props) => ({
            title: `Task Updated ✏️`,
            body: `${props.updaterName} has updated the task "${props.taskTitle}".`,
        }),
        Deleted: (props) => ({
            title: `Task Removed ❌`,
            body: `${props.ownerName} has deleted the task "${props.taskTitle}".`,
        }),
        SubtaskStatusChanged: (props) => ({
            title: `Subtask Status Updated 📝`,
            body: `${props.actorName} marked "${props.subtaskTitle}" in task "${props.taskTitle}" as ${props.status}.`,
        }),
        Comment: (props) => ({
            title: `New Comment on Task 💬`,
            body: `${props.commenterName} commented on "${props.taskTitle}": "${props.text}"`,
        }),
        SubtaskComment: (props) => ({
            title: `New Comment on Subtask 💬`,
            body: `${props.commenterName} commented on "${props.subtaskTitle}" in task "${props.taskTitle}": "${props.text}"`,
        }),
    },
    Profile: {
        PartnerConnected: (props) => ({
            title: `Partner Connection Established 🤝`,
            body: props.isForUser
                ? `You are now connected with ${props.partnerName}.`
                : `${props.userName} has connected with you.`,
        }),
    },
    List: {
        Created: (props) => ({
            title: `New List Created 🗂️`,
            body: `${props.ownerName} created a new list titled "${props.listTitle}".`,
        }),
        Updated: (props) => ({
            title: `List Updated ✏️`,
            body: `${props.ownerName} updated the list "${props.listTitle}".`,
        }),
        Deleted: (props) => ({
            title: `List Deleted ❌`,
            body: `${props.ownerName} deleted the list "${props.listTitle}".`,
        }),
        Pinned: (props) => ({
            title: `List ${props.pinned ? "Pinned 📌" : "Unpinned 📌"}`,
            body: `${props.ownerName} ${props.pinned ? "pinned" : "unpinned"} the list "${props.listTitle}".`,
        }),
        ItemStatus: (props) => ({
            title: `List Item Status Updated ✅`,
            body: `${props.ownerName} marked an item in the list "${props.listTitle}" as ${props.completed ? "completed" : "incomplete"}.`,
        }),
    },
    Note: {
        Created: (props) => ({
            title: `New Note Added 📝`,
            body: `${props.ownerName} added a new note titled "${props.noteTitle}".`,
        }),
        Updated: (props) => ({
            title: `Note Updated ✏️`,
            body: `${props.ownerName} updated the note "${props.noteTitle}".`,
        }),
        Deleted: (props) => ({
            title: `Note Deleted ❌`,
            body: `${props.ownerName} deleted the note "${props.noteTitle}".`,
        }),
        Pinned: (props) => ({
            title: `Note ${props.pinned ? "Pinned 📌" : "Unpinned 📌"}`,
            body: `${props.ownerName} ${props.pinned ? "pinned" : "unpinned"} the note "${props.noteTitle}".`,
        }),
    },
    Video: {
        Added: (props) => ({
            title: `New Video Added 🎥`,
            body: `${props.ownerName} added a new video titled "${props.videoTitle}".`,
        }),
        Deleted: (props) => ({
            title: `Video Removed ❌`,
            body: `The video "${props.videoTitle}" has been deleted.`,
        }),
        Viewed: (props) => ({
            title: `Video Viewed ✅`,
            body: `Your video "${props.videoTitle}" has been viewed.`,
        }),
        Comment: (props) => ({
            title: `New Comment on Video 💬`,
            body: `${props.commenterName} commented on "${props.videoTitle}": "${props.text}"`,
        }),
    },
};
