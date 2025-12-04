import { IAIProvider } from '../interfaces/IAIProvider'
import { IDatabaseProvider, QueryResult } from '../interfaces/IDatabaseProvider'
import { AnyData } from '../utils/utils'

export class TextToSQLService {
	constructor(private aiProvider: IAIProvider, private dbProvider: IDatabaseProvider) {}

	async processQuery(naturalLanguageQuery: string): Promise<{
		query: string
		generatedSQL: string
		result: QueryResult
		executionTime: number
	}> {
		const startTime = Date.now()

		try {
			// Get database schema
			const schema = await this.dbProvider.getSchema()

			// Generate SQL using AI
			const generatedSQL = await this.aiProvider.generateSQL(naturalLanguageQuery, schema)

			// Execute the generated SQL
			const result = await this.dbProvider.executeQuery(generatedSQL)

			const executionTime = Date.now() - startTime

			return {
				query: naturalLanguageQuery,
				generatedSQL,
				result,
				executionTime,
			}
		} catch (error: AnyData) {
			throw new Error(`Failed to process query: ${error.message}`)
		}
	}
}
