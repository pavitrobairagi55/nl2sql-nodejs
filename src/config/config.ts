import { config as dotenvConfig } from 'dotenv'
import { PoolConfig } from 'pg'

// Load environment variables from .env file
dotenvConfig()

export interface AppConfig {
	ai: {
		provider: 'ollama' | 'openai'
		model: string
		baseUrl?: string
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
}

export function getConfig(configName: string): AppConfig {
	const config = configs[configName]
	if (!config) {
		throw new Error(`Configuration '${configName}' not found`)
	}
	return config
}
