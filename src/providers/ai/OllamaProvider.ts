import { IAIProvider, OllamaResponse } from '../../interfaces/IAIProvider'
import { PGDBSchema } from '../../interfaces/IPGDBProvider'

export class OllamaProvider implements IAIProvider {
	private model: string
	private baseUrl: string

	constructor(model: string = 'llama3.2', baseUrl: string = 'http://localhost:11434') {
		this.model = model
		this.baseUrl = baseUrl
	}

	async generateDBQuery(naturalQuery: string, schema: PGDBSchema): Promise<string> {
		const schemaText = this.formatSchemaDetailed(schema)

		const prompt = `DATABASE SCHEMA:
${schemaText}

TASK: Convert this question to PostgreSQL SQL: "${naturalQuery}"

RESPOND WITH ONLY THE SQL QUERY. NO TEXT BEFORE OR AFTER.
EXAMPLE RESPONSE: SELECT * FROM "orders" WHERE "price" > 100 LIMIT 10;

YOUR SQL QUERY:
`

		try {
			const response = await fetch(`${this.baseUrl}/api/generate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: 'llama3.2',
					prompt: prompt,
					stream: false,
					options: {
						temperature: 0.0,
						top_p: 0.1,
						top_k: 10,
						num_predict: 100,
						repeat_penalty: 1.1,
						stop: ['\n\n', '\n', 'Note', 'To get', 'This query', 'Explanation'],
					},
				}),
			})

			if (!response.ok) {
				throw new Error(`Ollama HTTP error: ${response.status}`)
			}

			const data = (await response.json()) as OllamaResponse
			console.log('Raw LLM Response:', data.response)

			let sql = this.extractSQL(data.response)
			console.log('Extracted SQL:', sql)

			if (!sql || sql.length < 10 || !sql.toUpperCase().includes('SELECT')) {
				throw new Error('LLM did not generate valid SQL')
			}

			return sql
		} catch (error: any) {
			console.error('Ollama Error:', error.message)
			throw new Error(`Failed to generate SQL: ${error.message}`)
		}
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

	formatSchemaDetailed(schema: PGDBSchema): string {
		let text = ''
		Object.entries(schema.tables).forEach(([table, cols]) => {
			text += `"${table}": ${cols.map((c) => `"${c.name}"`).join(', ')}\n`
		})
		return text
	}
}
