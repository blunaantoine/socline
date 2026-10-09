/**
 * instrumentation Next.js — exécuté une fois au démarrage du serveur.
 * Démarre le scheduler des rappels de rendez-vous planifiés (option C).
 * Runtime node uniquement (Prisma + socket ne vivent pas sur Edge).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReminderScheduler } = await import('@/lib/reminder-scheduler');
    startReminderScheduler();
  }
}
