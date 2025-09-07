export enum TaskStatus {
  Active = "Active",
  Completed = "Completed",
  Expired = "Expired",
}

export enum SubtaskStatus {
  Pending = "Pending",
  Completed = "Completed",
  Expired = "Expired",
}

export enum AssignedTo {
  Me = "Me",
  Partner = "Partner",
  Both = "Both",
}

export enum Priority {
  Low = "Low",
  High = "High",
  Urgent = "Urgent",
}

export enum Frequency {
  Once = "Once",
  Daily = "Daily",
  Weekly = "Weekly",
}

export enum Recurrence {
  OneTime = "One-time",
  Daily = "Daily",
  Weekly = "Weekly",
  Monthly = "Monthly",
  UntilOff = "UntilOff",
}
