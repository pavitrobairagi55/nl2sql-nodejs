import { ExtractedSchema, PGDBSchema } from './IPGDBProvider'

export interface QueryResult {
	rows: any[]
	rowCount: number
	fields?: any[]
}

export interface IDatabaseProvider {
	connect(): Promise<void>
	disconnect(): Promise<void>
	executeQuery(query: string): Promise<QueryResult>
	validateQuery(query: string, schema: PGDBSchema): Promise<string | false>
	getSchema(): Promise<ExtractedSchema>
}
