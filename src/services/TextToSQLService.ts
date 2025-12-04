import { IAIProvider } from '../interfaces/IAIProvider'
import { IDatabaseProvider, QueryResult } from '../interfaces/IDatabaseProvider'
import { AnyData } from '../utils/utils'

export class TextToSQLService {
	constructor(private aiProvider: IAIProvider, private dbProvider: IDatabaseProvider) {}

	async processQuery(naturalLanguageQuery: string): Promise<{
		query: string
		dbQuery: string
		result: QueryResult
		executionTime: number
	}> {
		const startTime = Date.now()

		try {
			// Get database schema
			const schema = await this.dbProvider.getSchema()

			// 🔍 DEBUG: Log the actual schema
			console.log('=== SCHEMA DEBUG ===')
			console.log('Available tables:', Object.keys(schema.tables))
			if (schema.tables['orders']) {
				console.log(
					'Orders table columns:',
					schema.tables['orders'].map((c) => c.name)
				)
			}
			console.log('===================')

			// Generate dbQuery using AI
			const dbQuery = await this.aiProvider.generateDBQuery(naturalLanguageQuery, schema)
			console.log('generated query......', dbQuery)

			// Validate generated query
			const validatedQuery = await this.dbProvider.validateQuery(dbQuery, schema)
			if (!validatedQuery) {
				throw new Error('Generated SQL is invalid. Please rephrase your query.')
			}

			// Execute the generated dbQuery
			const result = await this.dbProvider.executeQuery(validatedQuery)

			const executionTime = Date.now() - startTime

			return {
				query: naturalLanguageQuery,
				dbQuery,
				result,
				executionTime,
			}
		} catch (error: AnyData) {
			throw new Error(`Failed to process query: ${error.message}`)
		}
	}
}
