import { GoogleGenerativeAI } from '@google/generative-ai'
import { IAIProvider } from '../../interfaces/IAIProvider'

export class GoogleGenAIProvider implements IAIProvider {
	private genAI: GoogleGenerativeAI
	private model: any

	constructor(modelName: string = 'gemini-pro', apiKey?: string) {
		const key = apiKey || process.env.GOOGLE_API_KEY
		if (!key) {
			throw new Error('Google API key is required')
		}
		this.genAI = new GoogleGenerativeAI(key)
		this.model = this.genAI.getGenerativeModel({ model: modelName })
	}

	async generateDBQuery(naturalLanguageQuery: string, schema: string): Promise<string> {
		const prompt = this.buildPrompt(naturalLanguageQuery, schema)

		try {
			const result = await this.model.generateContent(prompt)
			const response = await result.response
			const text = response.text()
			return this.extractSQL(text)
		} catch (error: any) {
			throw new Error(`Failed to generate SQL: ${error.message}`)
		}
	}

	private buildPrompt(query: string, schema: string): string {
		return `You are a SQL expert. Given the following database schema and a natural language query, generate ONLY the SQL query without any explanation, markdown formatting, or code blocks.

Database Schema:
${schema}

Natural Language Query: ${query}

Generate the SQL query (raw SQL only, no formatting):
`
	}

	private extractSQL(response: string): string {
		// Remove markdown code blocks if present
		let sql = response.trim()
		sql = sql.replace(/```sql\n?/g, '')
		sql = sql.replace(/```\n?/g, '')
		sql = sql.trim()

		// Remove any explanatory text before the SQL
		const lines = sql.split('\n')
		const sqlLines = lines.filter((line) => {
			const trimmed = line.trim().toUpperCase()
			return (
				trimmed.startsWith('SELECT') ||
				trimmed.startsWith('INSERT') ||
				trimmed.startsWith('UPDATE') ||
				trimmed.startsWith('DELETE') ||
				trimmed.startsWith('WITH') ||
				(line.trim() && !trimmed.match(/^(HERE|THE|THIS|QUERY)/))
			)
		})

		return sqlLines.join('\n').trim()
	}
}
