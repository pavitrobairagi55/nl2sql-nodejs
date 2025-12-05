import OpenAI from 'openai'
import { IAIProvider } from '../../interfaces/IAIProvider'

export class OpenAIProvider implements IAIProvider {
	private client: OpenAI
	private model: string

	constructor(model: string = 'gpt-4o-mini', apiKey?: string) {
		this.model = model
		this.client = new OpenAI({
			apiKey: apiKey || process.env.OPENAI_API_KEY,
		})
	}

	async generateDBQuery(naturalLanguageQuery: string, schema: string): Promise<string> {
		const prompt = this.buildPrompt(naturalLanguageQuery, schema)

		try {
			const response = await this.client.chat.completions.create({
				model: this.model,
				messages: [
					{
						role: 'system',
						content: 'You are a SQL expert. Generate ONLY the SQL query without any explanation, markdown formatting, or preamble.',
					},
					{
						role: 'user',
						content: prompt,
					},
				],
				temperature: 0.1,
				max_tokens: 500,
			})

			const generatedSQL = response.choices[0]?.message?.content || ''
			return this.extractSQL(generatedSQL)
		} catch (error: any) {
			throw new Error(`Failed to generate SQL with OpenAI: ${error.message}`)
		}
	}

	private buildPrompt(query: string, schema: string): string {
		return `Given the following database schema and a natural language query, generate ONLY the SQL query without any explanation or markdown formatting.

Database Schema:
${schema}

Natural Language Query: ${query}

Generate the SQL query:`
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
				(line.trim() && !trimmed.match(/^(HERE|THE|THIS)/))
			)
		})

		return sqlLines.join('\n').trim()
	}
}
