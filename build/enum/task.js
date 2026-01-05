export var TaskStatus;
(function (TaskStatus) {
    TaskStatus["Active"] = "Active";
    TaskStatus["Completed"] = "Completed";
    TaskStatus["Expired"] = "Expired";
})(TaskStatus || (TaskStatus = {}));
export var SubtaskStatus;
(function (SubtaskStatus) {
    SubtaskStatus["Pending"] = "Pending";
    SubtaskStatus["PartiallyComplete"] = "PartiallyComplete";
    SubtaskStatus["Completed"] = "Completed";
    SubtaskStatus["Expired"] = "Expired";
})(SubtaskStatus || (SubtaskStatus = {}));
export var AssignedTo;
(function (AssignedTo) {
    AssignedTo["Me"] = "Me";
    AssignedTo["Partner"] = "Partner";
    AssignedTo["Both"] = "Both";
})(AssignedTo || (AssignedTo = {}));
export var Priority;
(function (Priority) {
    Priority["Low"] = "Low";
    Priority["High"] = "High";
    Priority["Urgent"] = "Urgent";
})(Priority || (Priority = {}));
export var Frequency;
(function (Frequency) {
    Frequency["Once"] = "Once";
    Frequency["Daily"] = "Daily";
    Frequency["Weekly"] = "Weekly";
})(Frequency || (Frequency = {}));
export var Recurrence;
(function (Recurrence) {
    Recurrence["OneTime"] = "One-time";
    Recurrence["Daily"] = "Daily";
    Recurrence["Weekly"] = "Weekly";
    Recurrence["Monthly"] = "Monthly";
    Recurrence["UntilOff"] = "UntilOff";
})(Recurrence || (Recurrence = {}));
