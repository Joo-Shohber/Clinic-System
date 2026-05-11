export enum Role {
  PATIENT = "patient",
  DOCTOR = "doctor",
  ADMIN = "admin",
}

export enum AppointmentStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
  EXPIRED = "expired",
}

export enum PaymentStatus {
  UNPAID = "unpaid",
  PAID = "paid",
  REFUNDED = "refunded",
}

export enum Day {
  MON = "Mon",
  TUE = "Tue",
  WED = "Wed",
  THU = "Thu",
  FRI = "Fri",
  SAT = "Sat",
  SUN = "Sun",
}

export enum NotificationType {
  APPOINTMENT_CONFIRMED = "appointment_confirmed",
  APPOINTMENT_CANCELLED = "appointment_cancelled",
  APPOINTMENT_EXPIRED = "appointment_expired",
  APPOINTMENT_COMPLETED = "appointment_completed",
  APPOINTMENT_REMINDER = "appointment_reminder",
}
