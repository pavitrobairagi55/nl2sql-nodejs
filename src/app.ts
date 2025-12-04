import express, { Application } from 'express'
import { Server } from 'http' // ADD THIS IMPORT
import { QueryController } from './controllers/QueryController'
import { TextToSQLService } from './services/TextToSQLService'
import { OllamaProvider } from './providers/ai/OllamaProvider'
import { PostgresProvider } from './providers/database/PostgresProvider'
import { AppConfig } from './config/config'
import { IAIProvider } from './interfaces/IAIProvider'
import { IDatabaseProvider } from './interfaces/IDatabaseProvider'
import path from 'path'
import cors from 'cors'

export class App {
	private app: Application
	private server: Server | null = null // ADD THIS
	private dbProvider: IDatabaseProvider | null = null

	constructor(private config: AppConfig) {
		this.app = express()
		this.setupMiddleware()
	}

	private setupMiddleware(): void {
		this.app.use(express.json())
		this.app.use(express.urlencoded({ extended: true }))
		this.app.use(express.static(path.join(__dirname, 'public')))
		this.app.use(cors())
	}

	private createAIProvider(): IAIProvider {
		switch (this.config.ai.provider) {
			case 'ollama':
				return new OllamaProvider(this.config.ai.model, this.config.ai.baseUrl)
			default:
				throw new Error(`Unsupported AI provider: ${this.config.ai.provider}`)
		}
	}

	private createDatabaseProvider(): IDatabaseProvider {
		switch (this.config.database.provider) {
			case 'postgres':
				return new PostgresProvider(this.config.database.config)
			default:
				throw new Error(`Unsupported database provider: ${this.config.database.provider}`)
		}
	}

	private setupRoutes(controller: QueryController): void {
		this.app.post('/api/query', (req, res) => controller.handleQuery(req, res))

		this.app.get('/health', (req, res) => {
			res.status(200).json({ status: 'ok' })
		})
	}

	async start(): Promise<void> {
		try {
			console.log('📝 Initializing providers...')
			// Initialize providers
			const aiProvider = this.createAIProvider()
			this.dbProvider = this.createDatabaseProvider()

			console.log('🔌 Connecting to database...')
			// Connect to database
			await this.dbProvider.connect()

			console.log('🛠️  Setting up service and controller...')
			// Initialize service and controller
			const textToSQLService = new TextToSQLService(aiProvider, this.dbProvider)
			const queryController = new QueryController(textToSQLService)

			console.log('🛣️  Setting up routes...')
			// Setup routes
			this.setupRoutes(queryController)

			console.log('🚀 Starting HTTP server...')
			// Start server - STORE THE SERVER INSTANCE
			this.server = this.app.listen(this.config.server.port, () => {
				console.log(`
🚀 Server running on port ${this.config.server.port}
📊 Database: ${this.config.database.provider}
🤖 AI Model: ${this.config.ai.provider}:${this.config.ai.model}
			`)
			})

			// Add error handler for server
			this.server.on('error', (error) => {
				console.error('❌ Server error:', error)
			})

			console.log('✅ Server instance created and listening')
		} catch (error) {
			console.error('Failed to start application:', error)
			await this.stop()
			process.exit(1)
		}
	}

	async stop(): Promise<void> {
		// CLOSE THE SERVER FIRST
		if (this.server) {
			await new Promise<void>((resolve) => {
				this.server?.close(() => {
					console.log('✓ Server closed')
					resolve()
				})
			})
		}

		// THEN CLOSE DATABASE
		if (this.dbProvider) {
			await this.dbProvider.disconnect()
		}
	}
}
