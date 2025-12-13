export const NotificationMessages = {
    Task: {
        Reminder: (props) => {
            return {
                title: "⏰ Subtask Reminder",
                body: `"${props.subtaskTitle}" is due in ${props.timeString}`,
            };
        },
        Created: (props) => {
            return {
                title: "📝 New Task",
                body: `${props.creatorName} created "${props.taskTitle}"${props.forYou ? " for you" : ""}`,
            };
        },
        Updated: (props) => {
            return {
                title: "✏️ Task Updated",
                body: `${props.updaterName} updated "${props.taskTitle}"`,
            };
        },
        Deleted: (props) => {
            return {
                title: "🗑️ Task Deleted",
                body: `${props.ownerName} deleted "${props.taskTitle}"`,
            };
        },
        SubtaskStatusChanged: (props) => {
            return {
                title: "✅ Subtask Status",
                body: `${props.actorName} marked "${props.subtaskTitle}" as ${props.status}`,
            };
        },
        Comment: (props) => {
            const cleanText = props.text?.trim();
            const truncatedText = cleanText && cleanText.length > 50
                ? cleanText.substring(0, 50) + "..."
                : cleanText;
            return {
                title: `💬 ${props.commenterName}`,
                body: truncatedText || `Commented on "${props.taskTitle}"`,
            };
        },
        SubtaskComment: (props) => {
            const cleanText = props.text?.trim();
            const truncatedText = cleanText && cleanText.length > 50
                ? cleanText.substring(0, 50) + "..."
                : cleanText;
            return {
                title: `💬 ${props.commenterName}`,
                body: truncatedText || `Commented on "${props.subtaskTitle}"`,
            };
        },
    },
    Profile: {
        PartnerConnected: (props) => {
            return {
                title: "🤝 Connection",
                body: props.isForUser
                    ? `You're now connected with ${props.partnerName}`
                    : `${props.userName} wants to connect with you`,
            };
        },
        PartnerProfileUpdated: (props) => {
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
        Created: (props) => {
            return {
                title: "📋 New List",
                body: `${props.ownerName} created "${props.listTitle}"`,
            };
        },
        Updated: (props) => {
            return {
                title: "✏️ List Updated",
                body: `${props.ownerName} updated "${props.listTitle}"`,
            };
        },
        Deleted: (props) => {
            return {
                title: "🗑️ List Deleted",
                body: `${props.ownerName} deleted "${props.listTitle}"`,
            };
        },
        Pinned: (props) => {
            return {
                title: props.pinned ? "📌 List Pinned" : "📍 List Unpinned",
                body: `${props.ownerName} ${props.pinned ? "pinned" : "unpinned"} "${props.listTitle}"`,
            };
        },
        Comment: (props) => {
            const cleanText = props.text?.trim();
            const truncatedText = cleanText && cleanText.length > 50
                ? cleanText.substring(0, 50) + "..."
                : cleanText;
            return {
                title: `💬 ${props.commenterName}`,
                body: truncatedText || `Commented on "${props.listTitle}"`,
            };
        },
        ItemStatus: (props) => {
            return {
                title: "✅ Item Status",
                body: `${props.ownerName} marked an item in "${props.listTitle}" as ${props.completed ? "completed" : "pending"}`,
            };
        },
    },
    Note: {
        Created: (props) => {
            return {
                title: "📝 New Note",
                body: `${props.ownerName} created "${props.noteTitle}"`,
            };
        },
        Updated: (props) => {
            return {
                title: "✏️ Note Updated",
                body: `${props.ownerName} updated "${props.noteTitle}"`,
            };
        },
        Deleted: (props) => {
            return {
                title: "🗑️ Note Deleted",
                body: `${props.ownerName} deleted "${props.noteTitle}"`,
            };
        },
        Comment: (props) => {
            const cleanText = props.text?.trim();
            const truncatedText = cleanText && cleanText.length > 50
                ? cleanText.substring(0, 50) + "..."
                : cleanText;
            return {
                title: `💬 ${props.commenterName}`,
                body: truncatedText || `Commented on "${props.noteTitle}"`,
            };
        },
        Pinned: (props) => {
            return {
                title: props.pinned ? "📌 Note Pinned" : "📍 Note Unpinned",
                body: `${props.ownerName} ${props.pinned ? "pinned" : "unpinned"} "${props.noteTitle}"`,
            };
        },
    },
    Video: {
        Added: (props) => {
            return {
                title: "🎬 New Video",
                body: `${props.ownerName} uploaded "${props.videoTitle}"`,
            };
        },
        Deleted: (props) => {
            return {
                title: "🗑️ Video Deleted",
                body: `"${props.videoTitle}" has been deleted`,
            };
        },
        Viewed: (props) => {
            return {
                title: "👀 Video Viewed",
                body: `Someone watched "${props.videoTitle}"`,
            };
        },
        Comment: (props) => {
            const cleanText = props.text?.trim();
            const truncatedText = cleanText && cleanText.length > 50
                ? cleanText.substring(0, 50) + "..."
                : cleanText;
            return {
                title: `💬 ${props.commenterName}`,
                body: truncatedText || `Commented on "${props.videoTitle}"`,
            };
        },
    },
};
