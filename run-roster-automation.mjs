import { runRosterAutomation } from './src/lib/roster/roster-automation/index.ts'

async function main() {
  try {
    const result = await runRosterAutomation()
    console.log('Resultado da automação:')
    console.dir(result, { depth: null })
  } catch (error) {
    console.error('Erro na automação:', error)
    process.exit(1)
  }
}

main()