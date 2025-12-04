import { Pool, PoolConfig } from 'pg'
import { IDatabaseProvider, QueryResult } from '../../interfaces/IDatabaseProvider.js'
import { AnyData } from '../../utils/utils.js'

export class PostgresProvider implements IDatabaseProvider {
	private pool: Pool
	private config: PoolConfig

	constructor(config: PoolConfig) {
		this.config = config
		this.pool = new Pool(config)
	}

	async connect(): Promise<void> {
		try {
			const client = await this.pool.connect()
			console.log('✓ Connected to PostgreSQL database')
			client.release()
		} catch (error: AnyData) {
			throw new Error(`Failed to connect to PostgreSQL: ${error.message}`)
		}
	}

	async disconnect(): Promise<void> {
		await this.pool.end()
		console.log('✓ Disconnected from PostgreSQL database')
	}

	async executeQuery(query: string): Promise<QueryResult> {
		try {
			const result = await this.pool.query(query)
			return {
				rows: result.rows,
				rowCount: result.rowCount || 0,
				fields: result.fields,
			}
		} catch (error: AnyData) {
			throw new Error(`Query execution failed: ${error.message}`)
		}
	}

	async getSchema(): Promise<string> {
		const schemaQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `

		try {
			const result = await this.pool.query(schemaQuery)
			return this.formatSchema(result.rows)
		} catch (error: AnyData) {
			throw new Error(`Failed to retrieve schema: ${error.message}`)
		}
	}

	private formatSchema(schemaData: any[]): string {
		const tables: { [key: string]: any[] } = {}

		schemaData.forEach((row) => {
			if (!tables[row.table_name]) {
				tables[row.table_name] = []
			}
			tables[row.table_name].push({
				column: row.column_name,
				type: row.data_type,
				nullable: row.is_nullable === 'YES',
			})
		})

		let schema = ''
		for (const [tableName, columns] of Object.entries(tables)) {
			schema += `Table: ${tableName}\n`
			columns.forEach((col) => {
				schema += `  - ${col.column}: ${col.type}${col.nullable ? '' : ' NOT NULL'}\n`
			})
			schema += '\n'
		}

		return schema
	}
}
