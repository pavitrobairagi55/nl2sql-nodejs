import { ExtractedSchema, PGDBSchema } from './IPGDBProvider'

export interface IAIProvider {
	generateDBQuery(naturalLanguageQuery: string, schema: PGDBSchema | string): Promise<string>
}

export interface OllamaResponse {
	response: string
}
