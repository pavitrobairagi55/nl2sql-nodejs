import express, { Application } from 'express'
import { QueryController } from './controllers/QueryController'
import { TextToSQLService } from './services/TextToSQLService'
import { OllamaProvider } from './providers/ai/OllamaProvider'
import { PostgresProvider } from './providers/database/PostgresProvider'
import { AppConfig } from './config/config'
import { IAIProvider } from './interfaces/IAIProvider'
import { IDatabaseProvider } from './interfaces/IDatabaseProvider'

export class App {
	private app: Application
	private dbProvider: IDatabaseProvider | null = null

	constructor(private config: AppConfig) {
		this.app = express()
		this.setupMiddleware()
	}

	private setupMiddleware(): void {
		this.app.use(express.json())
		this.app.use(express.urlencoded({ extended: true }))
	}

	private createAIProvider(): IAIProvider {
		switch (this.config.ai.provider) {
			case 'ollama':
				return new OllamaProvider(this.config.ai.model, this.config.ai.baseUrl)
			// case 'openai':
			//   return new OpenAIProvider(this.config.ai.model, this.config.ai.apiKey);
			default:
				throw new Error(`Unsupported AI provider: ${this.config.ai.provider}`)
		}
	}

	private createDatabaseProvider(): IDatabaseProvider {
		switch (this.config.database.provider) {
			case 'postgres':
				return new PostgresProvider(this.config.database.config)
			// case 'mysql':
			//   return new MySQLProvider(this.config.database.config);
			// case 'mongodb':
			//   return new MongoDBProvider(this.config.database.config);
			default:
				throw new Error(`Unsupported database provider: ${this.config.database.provider}`)
		}
	}

	private setupRoutes(controller: QueryController): void {
		this.app.post('/query', (req, res) => controller.handleQuery(req, res))

		this.app.get('/health', (req, res) => {
			res.status(200).json({ status: 'ok' })
		})
	}

	async start(): Promise<void> {
		try {
			// Initialize providers
			const aiProvider = this.createAIProvider()
			this.dbProvider = this.createDatabaseProvider()

			// Connect to database
			await this.dbProvider.connect()

			// Initialize service and controller
			const textToSQLService = new TextToSQLService(aiProvider, this.dbProvider)
			const queryController = new QueryController(textToSQLService)

			// Setup routes
			this.setupRoutes(queryController)

			// Start server
			this.app.listen(this.config.server.port, () => {
				console.log(`
🚀 Server running on port ${this.config.server.port}
📊 Database: ${this.config.database.provider}
🤖 AI Model: ${this.config.ai.provider}:${this.config.ai.model}
        `)
			})
		} catch (error) {
			console.error('Failed to start application:', error)
			await this.stop()
			process.exit(1)
		}
	}

	async stop(): Promise<void> {
		if (this.dbProvider) {
			await this.dbProvider.disconnect()
		}
	}
}
