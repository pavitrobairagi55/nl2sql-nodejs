import { App } from './app'
import { getConfig } from './config/config'

const configName = process.env.CONFIG || 'llama3.2-postgres'

async function main() {
	console.log('🔧 Starting application...')

	try {
		const config = getConfig(configName)
		const app = new App(config)

		// Graceful shutdown
		process.on('SIGINT', async () => {
			console.log('\n⚠️  SIGINT received - Shutting down gracefully...')
			await app.stop()
			process.exit(0)
		})

		process.on('SIGTERM', async () => {
			console.log('\n⚠️  SIGTERM received - Shutting down gracefully...')
			await app.stop()
			process.exit(0)
		})

		// Catch uncaught exceptions
		process.on('uncaughtException', (error) => {
			console.error('❌ Uncaught Exception:', error)
			process.exit(1)
		})

		// Catch unhandled rejections
		process.on('unhandledRejection', (reason, promise) => {
			console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
			process.exit(1)
		})

		// Add exit handler to debug
		process.on('exit', (code) => {
			console.log(`🛑 Process exiting with code: ${code}`)
		})

		await app.start()
		console.log('✅ Application started successfully - process should stay alive')
	} catch (error) {
		console.error('❌ Application error:', error)
		process.exit(1)
	}
}

main()
