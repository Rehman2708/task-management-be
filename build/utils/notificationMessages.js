export const NotificationMessages = {
    Task: {
        Reminder: (props) => {
            const variants = [
                `Heads up! "${props.subtaskTitle}" in "${props.taskTitle}" is due in ${props.timeString}.`,
                `⏰ Reminder: "${props.subtaskTitle}" under "${props.taskTitle}" will be due in ${props.timeString}.`,
                `Don't miss it! "${props.subtaskTitle}" in "${props.taskTitle}" is due soon—${props.timeString} left.`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `⏰ Subtask Reminder!`, body };
        },
        Created: (props) => {
            const variants = [
                `${props.creatorName} created "${props.taskTitle}" ${props.forYou ? "for you—go crush it!" : ""}`,
                `New task alert! "${props.taskTitle}" by ${props.creatorName} ${props.forYou ? "is all yours!" : ""}`,
                `"${props.taskTitle}" has been added by ${props.creatorName} ${props.forYou ? "just for you!" : ""}`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `🎯 New Task!`, body };
        },
        Updated: (props) => {
            const variants = [
                `${props.updaterName} updated "${props.taskTitle}". Check it out!`,
                `"${props.taskTitle}" has some new changes from ${props.updaterName}.`,
                `${props.updaterName} just tweaked "${props.taskTitle}".`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `✏️ Task Update`, body };
        },
        Deleted: (props) => {
            const variants = [
                `${props.ownerName} removed "${props.taskTitle}".`,
                `"${props.taskTitle}" was deleted by ${props.ownerName}.`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `❌ Task Deleted`, body };
        },
        SubtaskStatusChanged: (props) => {
            const variants = [
                `${props.actorName} marked "${props.subtaskTitle}" in "${props.taskTitle}" as ${props.status}.`,
                `"${props.subtaskTitle}" in "${props.taskTitle}" is now ${props.status}, updated by ${props.actorName}.`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `📝 Subtask Status`, body };
        },
        Comment: (props) => {
            const cleanText = props.text?.trim();
            const showText = cleanText ? `: "${cleanText}"` : "";
            const variants = [
                `${props.commenterName} commented on "${props.taskTitle}"${showText}`,
                `New comment from ${props.commenterName} on "${props.taskTitle}"${showText}`,
                `"${props.taskTitle}" got a comment from ${props.commenterName}${showText}`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `💬 Task Comment`, body };
        },
        SubtaskComment: (props) => {
            const cleanText = props.text?.trim();
            const showText = cleanText ? `: "${cleanText}"` : "";
            const variants = [
                `${props.commenterName} commented on "${props.subtaskTitle}" in "${props.taskTitle}"${showText}`,
                `"${props.subtaskTitle}" has a new comment from ${props.commenterName}${showText}`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `💡 Subtask Comment`, body };
        },
    },
    Profile: {
        PartnerConnected: (props) => {
            const variants = props.isForUser
                ? [
                    `You’re now connected with ${props.partnerName}! Exciting times!`,
                    `Say hello to ${props.partnerName}, your new connection!`,
                ]
                : [
                    `${props.userName} has connected with you. Say hi!`,
                    `${props.userName} wants to connect with you. Time to respond!`,
                ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `🤝 Connection Update`, body };
        },
        PartnerProfileUpdated: (props) => {
            const { changedFields, partnerName } = props;
            const fieldsText = changedFields.length === 1
                ? changedFields[0]
                : changedFields.slice(0, -1).join(", ") +
                    " and " +
                    changedFields.slice(-1);
            const variants = [
                `${partnerName} updated their ${fieldsText}. Take a look!`,
                `Your partner, ${partnerName}, has changed their ${fieldsText}.`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `📝 Profile Update`, body };
        },
    },
    List: {
        Created: (props) => {
            const variants = [
                `${props.ownerName} made a new list: "${props.listTitle}". Take a peek!`,
                `"${props.listTitle}" has been created by ${props.ownerName}.`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `🗂️ New List!`, body };
        },
        Updated: (props) => {
            const variants = [
                `${props.ownerName} updated "${props.listTitle}".`,
                `"${props.listTitle}" has some changes from ${props.ownerName}.`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `✏️ List Updated`, body };
        },
        Deleted: (props) => ({
            title: `❌ List Removed`,
            body: `${props.ownerName} deleted "${props.listTitle}".`,
        }),
        Pinned: (props) => ({
            title: `${props.pinned ? "📌 Pinned!" : "📍 Unpinned"}`,
            body: `${props.ownerName} ${props.pinned ? "pinned" : "unpinned"} "${props.listTitle}".`,
        }),
        Comment: (props) => {
            const cleanText = props.text?.trim();
            const showText = cleanText ? `: "${cleanText}"` : "";
            return {
                title: `💬 List Comment`,
                body: `${props.commenterName} commented on "${props.listTitle}"${showText}`,
            };
        },
        ItemStatus: (props) => ({
            title: `✅ Item Status`,
            body: `${props.ownerName} marked an item in "${props.listTitle}" as ${props.completed ? "done" : "not done yet"}.`,
        }),
    },
    Note: {
        Created: (props) => ({
            title: `📝 New Note`,
            body: `${props.ownerName} added "${props.noteTitle}".`,
        }),
        Updated: (props) => ({
            title: `✏️ Note Updated`,
            body: `${props.ownerName} updated "${props.noteTitle}".`,
        }),
        Deleted: (props) => ({
            title: `❌ Note Deleted`,
            body: `${props.ownerName} removed "${props.noteTitle}".`,
        }),
        Comment: (props) => {
            const cleanText = props.text?.trim();
            const showText = cleanText ? `: "${cleanText}"` : "";
            return {
                title: `💬 Note Comment`,
                body: `${props.commenterName} commented on "${props.noteTitle}"${showText}`,
            };
        },
        Pinned: (props) => ({
            title: `${props.pinned ? "📌 Pinned" : "📍 Unpinned"}`,
            body: `${props.ownerName} ${props.pinned ? "pinned" : "unpinned"} "${props.noteTitle}".`,
        }),
    },
    Video: {
        Added: (props) => {
            const variants = [
                `${props.ownerName} uploaded "${props.videoTitle}". Time to watch!`,
                `New video alert! "${props.videoTitle}" by ${props.ownerName}.`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `🎬 New Video!`, body };
        },
        Deleted: (props) => ({
            title: `❌ Video Removed`,
            body: `"${props.videoTitle}" has been deleted.`,
        }),
        Viewed: (props) => {
            const variants = [
                `Someone watched your video "${props.videoTitle}"! 👀`,
                `"${props.videoTitle}" just got a new view!`,
            ];
            const body = variants[Math.floor(Math.random() * variants.length)];
            return { title: `👀 Video Viewed`, body };
        },
        Comment: (props) => {
            const cleanText = props.text?.trim();
            const showText = cleanText ? `: "${cleanText}"` : "";
            return {
                title: `💬 Video Comment`,
                body: `${props.commenterName} commented on "${props.videoTitle}"${showText}`,
            };
        },
    },
};
