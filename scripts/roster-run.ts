import 'dotenv/config'
import { runNow, scheduledTask } from '../src/lib/roster/scheduler/index.ts'

async function main(): Promise<void> {
  try {
    await runNow()
    console.log('✅ Execução manual finalizada.')
  } catch (error) {
    console.error('❌ Falha na execução manual da escala:', error)
    process.exitCode = 1
  } finally {
    scheduledTask.stop()
  }
}

void main()
