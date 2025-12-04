import { PoolConfig } from 'pg'

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
				host: process.env.DB_HOST || 'localhost',
				port: parseInt(process.env.DB_PORT || '5432'),
				database: process.env.DB_NAME || 'mydb',
				user: process.env.DB_USER || 'postgres',
				password: process.env.DB_PASSWORD || 'password',
			},
		},
		server: {
			port: parseInt(process.env.PORT || '3000'),
		},
	},
	// Add more configurations here
	// 'llama3.2-mysql': { ... },
	// 'gpt4-postgres': { ... },
}

export function getConfig(configName: string): AppConfig {
	const config = configs[configName]
	if (!config) {
		throw new Error(`Configuration '${configName}' not found`)
	}
	return config
}
