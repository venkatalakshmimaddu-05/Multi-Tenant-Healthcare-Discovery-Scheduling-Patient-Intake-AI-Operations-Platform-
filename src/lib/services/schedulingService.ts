import { prisma } from "../prisma";
import { AvailableSlot } from "../types";

export class SchedulingService {
  // In-memory slot mutex locks to prevent concurrent race-condition double booking
  private static activeLocks: Map<string, number> = new Map();
  private static LOCK_TIMEOUT_MS = 15000; // 15s reservation lock window

  private static getLockKey(doctorId: string, startTimeIso: string): string {
    return `${doctorId}_${new Date(startTimeIso).toISOString()}`;
  }

  public static acquireLock(doctorId: string, startTimeIso: string): boolean {
    const key = this.getLockKey(doctorId, startTimeIso);
    const now = Date.now();
    const existingLockTime = this.activeLocks.get(key);

    if (existingLockTime && now - existingLockTime < this.LOCK_TIMEOUT_MS) {
      // Slot is currently locked by another concurrent booking request
      return false;
    }

    this.activeLocks.set(key, now);
    return true;
  }

  public static releaseLock(doctorId: string, startTimeIso: string): void {
    const key = this.getLockKey(doctorId, startTimeIso);
    this.activeLocks.delete(key);
  }

  /**
   * Generates real bookable slots for a doctor on a given target date.
   * Strictly respects:
   * 1. Active Doctor status
   * 2. Active Hospital status (must be APPROVED)
   * 3. Doctor working hours/calendar for the day of week
   * 4. Blocked slots (e.g. surgeries, rounds)
   * 5. Existing confirmed or pending appointments
   */
  public static async getAvailableSlots(doctorId: string, targetDate: Date): Promise<AvailableSlot[]> {
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        hospital: true,
        calendars: { where: { isActive: true } },
        blockedSlots: true,
      },
    });

    if (!doctor || doctor.status !== "ACTIVE" || doctor.hospital.status !== "APPROVED") {
      return [];
    }

    const dayOfWeek = targetDate.getDay(); // 0-6
    const calendar = doctor.calendars.find((c) => c.dayOfWeek === dayOfWeek);

    if (!calendar) {
      return []; // Doctor does not work on this day
    }

    // Parse start and end times e.g. "09:00" and "17:00"
    const [startHour, startMin] = calendar.startTime.split(":").map(Number);
    const [endHour, endMin] = calendar.endTime.split(":").map(Number);
    const slotDuration = calendar.slotDurationMinutes || 30;

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch existing appointments for the day
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { in: ["CONFIRMED", "PENDING", "SYNCHRONIZATION_PENDING"] },
      },
    });

    // Fetch blocked slots for the doctor
    const blockedSlots = doctor.blockedSlots.filter((b) => {
      return (
        (b.startTime <= endOfDay && b.endTime >= startOfDay)
      );
    });

    const slots: AvailableSlot[] = [];
    const currentTime = new Date(targetDate);
    currentTime.setHours(startHour, startMin, 0, 0);

    const finishTime = new Date(targetDate);
    finishTime.setHours(endHour, endMin, 0, 0);

    while (currentTime.getTime() + slotDuration * 60000 <= finishTime.getTime()) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

      // Check collision with existing appointments
      const isApptBooked = existingAppointments.some((appt) => {
        const apptStart = new Date(appt.startTime).getTime();
        const apptEnd = new Date(appt.endTime).getTime();
        return slotStart.getTime() < apptEnd && slotEnd.getTime() > apptStart;
      });

      // Check collision with blocked slots
      const isBlocked = blockedSlots.some((block) => {
        const blockStart = new Date(block.startTime).getTime();
        const blockEnd = new Date(block.endTime).getTime();
        return slotStart.getTime() < blockEnd && slotEnd.getTime() > blockStart;
      });

      if (!isApptBooked && !isBlocked) {
        slots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          formattedTime: slotStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
          formattedDate: slotStart.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          isAvailable: true,
        });
      }

      currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
    }

    return slots;
  }

  /**
   * Revalidates availability immediately before booking to ensure no concurrent collision.
   */
  public static async isSlotStillAvailable(doctorId: string, startTime: Date, endTime: Date): Promise<boolean> {
    const existing = await prisma.appointment.findFirst({
      where: {
        doctorId,
        status: { in: ["CONFIRMED", "PENDING", "SYNCHRONIZATION_PENDING"] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    if (existing) return false;

    const blocked = await prisma.blockedSlot.findFirst({
      where: {
        doctorId,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });

    return !blocked;
  }
}