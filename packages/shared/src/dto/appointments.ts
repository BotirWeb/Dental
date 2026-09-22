import { z } from "zod";
import { APPOINTMENT_STATUSES } from "../enums";

/** Ekran 2 "Jadval" / ekran 5 "Yozuv modal". */
export const appointmentSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  patientId: z.string(),
  doctorId: z.string(),
  chairId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(APPOINTMENT_STATUSES),
  note: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
});
export type Appointment = z.infer<typeof appointmentSchema>;

/** `GET /api/appointments` javobi — jadval katagida ism ko'rsatish uchun `patientFullName` qo'shilgan. */
export const appointmentWithPatientSchema = appointmentSchema.extend({
  patientFullName: z.string(),
});
export type AppointmentWithPatient = z.infer<typeof appointmentWithPatientSchema>;

/** Bemor kartasida (ekran 4) ko'rsatish uchun — bemor ismi/telefoni kerak emas, o'zi allaqachon o'sha bemor sahifasida. */
export const createAppointmentSchema = z
  .object({
    patientId: z.string().min(1, "Bemor tanlanishi shart"),
    doctorId: z.string().min(1, "Shifokor tanlanishi shart"),
    chairId: z.string().min(1, "Kreslo tanlanishi shart"),
    startAt: z.string().min(1, "Boshlanish vaqti shart"),
    endAt: z.string().min(1, "Tugash vaqti shart"),
    note: z.string().optional(),
  })
  .refine((v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
    message: "Tugash vaqti boshlanish vaqtidan keyin bo'lsin",
    path: ["endAt"],
  });
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
});
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;

/**
 * `GET /api/appointments` so'rovi. Ikki rejim:
 *   - `from`+`to` — ekran 2 "Jadval": bitta kun/hafta oralig'i.
 *   - `patientId` — ekran 4 "Bemor kartasi": shu bemorning barcha yozuvlari
 *     (sana chegarasisiz).
 */
export const scheduleQuerySchema = z
  .object({
    from: z.string().optional(),
    to: z.string().optional(),
    patientId: z.string().optional(),
  })
  .refine((v) => (v.from && v.to) || v.patientId, {
    message: "from+to yoki patientId kerak",
  });
export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;
