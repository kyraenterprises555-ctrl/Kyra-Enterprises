declare global {
  // eslint-disable-next-line no-var
  var __kyraReminderSchedulerStarted: boolean | undefined;
}

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.ENABLE_INTERNAL_SCHEDULER !== "false" &&
    !global.__kyraReminderSchedulerStarted
  ) {
    global.__kyraReminderSchedulerStarted = true;

    // Background hourly sweep for due 3-day / 4-day payment reminders & transient retries
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const timer = setInterval(async () => {
      try {
        const { DataService } = await import("@/lib/db-store");
        await DataService.runPaymentReminderCycle({ triggeredBy: "cron" });
      } catch (err) {
        console.error("[Kyra Enterprises Reminder Worker] Cycle error:", err);
      }
    }, ONE_HOUR_MS);

    if (typeof timer.unref === "function") {
      timer.unref();
    }
  }
}
