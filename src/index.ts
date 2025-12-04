import { App } from './app'
import { getConfig } from './config/config'

const configName = process.env.CONFIG || 'llama3.2-postgres'

async function main() {
	try {
		const config = getConfig(configName)
		const app = new App(config)

		// Graceful shutdown
		process.on('SIGINT', async () => {
			console.log('\nShutting down gracefully...')
			await app.stop()
			process.exit(0)
		})

		await app.start()
	} catch (error) {
		console.error('Application error:', error)
		process.exit(1)
	}
}

main()
