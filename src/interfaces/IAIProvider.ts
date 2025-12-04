import { ExtractedSchema } from './IPGDBProvider'

export interface IAIProvider {
	generateDBQuery(naturalLanguageQuery: string, schema: ExtractedSchema): Promise<string>
}

export interface OllamaResponse {
	response: string
}
