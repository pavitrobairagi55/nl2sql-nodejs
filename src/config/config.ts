import { config as dotenvConfig } from 'dotenv'
import { PoolConfig } from 'pg'

// Load environment variables from .env file
dotenvConfig()

export interface AppConfig {
	ai: {
		provider: 'ollama' | 'openai'
		model: string
		baseUrl?: string
		apiKey?: string
	}
	database: {
		provider: 'postgres' | 'mysql' | 'mongodb'
		config: PoolConfig | any
	}
	server: {
		port: number
	}
}

export const configs: Record<string, AppConfig> = {
	'llama3.2-postgres': {
		ai: {
			provider: 'ollama',
			model: 'llama3.2',
			baseUrl: 'http://localhost:11434',
		},
		database: {
			provider: 'postgres',
			config: {
				host: process.env.PG_DB_HOST || 'localhost',
				port: parseInt(process.env.PG_DB_PORT || '5432'),
				database: process.env.PG_DB_NAME || 'mydb',
				user: process.env.PG_DB_USER || 'postgres',
				password: process.env.PG_DB_PASSWORD || 'password',
			},
		},
		server: {
			port: parseInt(process.env.PORT || '3000'),
		},
	},
	'gpt4-mysql': {
		ai: {
			provider: 'openai',
			model: 'gpt-4o-mini',
			apiKey: process.env.OPENAI_API_KEY,
		},
		database: {
			provider: 'mysql',
			config: {
				host: process.env.MYSQL_DB_HOST || 'localhost',
				port: parseInt(process.env.MYSQL_DB_PORT || '3306'),
				database: process.env.MYSQL_DB_NAME || 'mydb',
				user: process.env.MYSQL_DB_USER || 'root',
				password: process.env.MYSQL_DB_PASSWORD || 'password',
				waitForConnections: true,
				connectionLimit: 10,
				queueLimit: 0,
			},
		},
		server: {
			port: parseInt(process.env.PORT || '3000'),
		},
	},
}

export function getConfig(configName: string): AppConfig {
	const config = configs[configName]
	if (!config) {
		throw new Error(`Configuration '${configName}' not found`)
	}
	return config
}
