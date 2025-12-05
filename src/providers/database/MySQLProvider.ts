import mysql from 'mysql2/promise'
import { IDatabaseProvider, QueryResult } from '../../interfaces/IDatabaseProvider'
import { ExtractedSchema, PGDBSchema } from '../../interfaces/IPGDBProvider'
import { AnyData } from '../../utils/utils'

export class MySQLProvider implements IDatabaseProvider {
	private pool: mysql.Pool
	private config: mysql.PoolOptions

	constructor(config: mysql.PoolOptions) {
		this.config = config
		this.pool = mysql.createPool(config)

		// Add error handler for pool
		this.pool.on('connection', (connection) => {
			console.log('🔌 New MySQL connection established')
		})
	}

	async connect(): Promise<void> {
		try {
			const connection = await this.pool.getConnection()
			console.log('✓ Connected to MySQL database')
			connection.release()
		} catch (error: AnyData) {
			throw new Error(`Failed to connect to MySQL: ${error.message}`)
		}
	}

	async disconnect(): Promise<void> {
		await this.pool.end()
		console.log('✓ Disconnected from MySQL database')
	}

	async executeQuery(query: string): Promise<QueryResult> {
		try {
			const [rows, fields] = await this.pool.query(query)
			return {
				rows: rows as any[],
				rowCount: (rows as any[]).length,
				fields: fields as any[],
			}
		} catch (error: AnyData) {
			throw new Error(`Query execution failed: ${error.message}`)
		}
	}

	async validateQuery(query: string, schema: string): Promise<string | false> {
		// 1. Dangerous patterns
		const dangerousPatterns = [/;\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\s+/i, /UNION\s+SELECT/i, /EXEC(UTE)?\s*\(/i, /--/, /\/\*/]

		if (dangerousPatterns.some((p) => p.test(query))) {
			return false
		}

		// 2. Must be a SELECT query
		if (!query.trim().toUpperCase().startsWith('SELECT')) {
			return false
		}

		// 3. Extract table names from schema string
		const tableNames = schema
			.split('\n')
			.filter((line) => line.trim().startsWith('Table:'))
			.map((line) => line.replace('Table:', '').trim().toLowerCase())

		const queryUpper = query.toUpperCase()
		const fromMatch = queryUpper.match(/FROM\s+(\w+)/i)

		if (fromMatch) {
			const table = fromMatch[1].toLowerCase()
			if (!tableNames.includes(table)) {
				return false
			}
		}

		// 4. Safe SQL syntax validation
		try {
			// Remove trailing semicolons
			const cleanedQuery = query.replace(/;+\s*$/, '')

			// Wrap in a subquery (works with LIMIT, ORDER BY, etc.)
			const validateSQL = `SELECT * FROM (${cleanedQuery}) AS _q LIMIT 0`

			await this.pool.query(validateSQL)
			return query
		} catch (err) {
			console.log('VALIDATION ERROR:', err)
			return false
		}
	}

	async getSchema(): Promise<ExtractedSchema | string> {
		const schemaQuery = `
			SELECT 
				TABLE_NAME as table_name,
				COLUMN_NAME as column_name,
				DATA_TYPE as data_type,
				IS_NULLABLE as is_nullable,
				COLUMN_KEY as column_key,
				COLUMN_DEFAULT as column_default
			FROM INFORMATION_SCHEMA.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE()
			ORDER BY TABLE_NAME, ORDINAL_POSITION;
		`

		try {
			const [rows] = await this.pool.query(schemaQuery)
			return this.formatSchema(rows as any[])
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
				key: row.column_key,
				default: row.column_default,
			})
		})

		let schema = ''
		for (const [tableName, columns] of Object.entries(tables)) {
			schema += `Table: ${tableName}\n`
			columns.forEach((col) => {
				const keyInfo = col.key === 'PRI' ? ' PRIMARY KEY' : col.key === 'UNI' ? ' UNIQUE' : ''
				schema += `  - ${col.column}: ${col.type}${col.nullable ? '' : ' NOT NULL'}${keyInfo}\n`
			})
			schema += '\n'
		}

		return schema
	}
}
