import { runRosterJob, startRosterScheduler } from './rosterScheduler.ts'

const scheduledTask = startRosterScheduler()

export async function runNow(): Promise<void> {
  await runRosterJob()
}

export { scheduledTask }
