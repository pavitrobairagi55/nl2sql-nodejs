import { Pool, PoolClient, PoolConfig, QueryResult as QueryResultPG } from 'pg'
import { IDatabaseProvider } from '../../interfaces/IDatabaseProvider.js'
import { AnyData } from '../../utils/utils.js'
import { PGDBSchema, ExtractedSchema, ForeignKeyInfo, TableSchema } from '../../interfaces/IPGDBProvider.js'

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

	async executeQuery(sql: string): Promise<any> {
		const client = await this.pool.connect()
		try {
			let safeSql = sql

			if (!sql.toUpperCase().includes('LIMIT')) {
				safeSql = sql.replace(/;?\s*$/, ' LIMIT 1000;')
			}

			const result = await client.query(safeSql)
			return {
				rows: result.rows,
				rowCount: result.rowCount,
				fields: result.fields.map((f) => f.name),
			}
		} finally {
			client.release()
		}
	}

	async getSchema(): Promise<ExtractedSchema> {
		const client: PoolClient = await this.pool.connect()

		try {
			// --- Fetch Tables ---
			const tablesResult: QueryResultPG<{ table_name: string }> = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `)

			const schema: TableSchema = {}

			// --- Fetch Columns for Each Table ---
			for (const table of tablesResult.rows) {
				const columnsResult: QueryResultPG<{
					column_name: string
					data_type: string
					is_nullable: string
					column_default: string | null
				}> = await client.query(
					`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1;
      `,
					[table.table_name]
				)

				schema[table.table_name] = columnsResult.rows.map((col) => ({
					name: col.column_name,
					type: col.data_type,
					nullable: col.is_nullable === 'YES',
					default: col.column_default,
				}))
			}

			// --- Foreign Keys ---
			const foreignKeysResult: QueryResultPG<ForeignKeyInfo> = await client.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY' AND tc.table_schema='public';
    `)

			return {
				tables: schema,
				foreignKeys: foreignKeysResult.rows,
			}
		} finally {
			client.release()
		}
	}

	async validateQuery(query: string, schema: PGDBSchema): Promise<string | false> {
		if (!query) return false

		const client = await this.pool.connect()

		try {
			let fixedSQL = this.smartQuoteIdentifiers(query, schema)

			if (!fixedSQL.trim().endsWith(';')) {
				fixedSQL = fixedSQL.trim() + ';'
			}

			console.log('Validating SQL:', fixedSQL)

			await client.query('EXPLAIN ' + fixedSQL)
			console.log('✅ SQL validated successfully')
			return fixedSQL
		} catch (error: any) {
			console.error('Validation Error:', error.message)

			const altSQL = this.attemptAutoFix(query, schema, error.message)
			if (altSQL) {
				try {
					await client.query('EXPLAIN ' + altSQL)
					console.log('✅ Auto-fixed SQL:', altSQL)
					return altSQL
				} catch (e) {
					console.error('Auto-fix failed:', (e as any).message)
				}
			}
			return false
		} finally {
			client.release()
		}
	}

	attemptAutoFix(sql: string, schema: PGDBSchema, errorMessage: string): string | null {
		let fixed = sql

		fixed = fixed.replace(/\b(SELECT|FROM|WHERE|ORDER|BY)\s+\1\b/gi, '$1')

		// Fix unknown columns
		if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
			const match = errorMessage.match(/column "?([^"\s]+)"?/i)
			if (match) {
				const wrongCol = match[1]
				let bestMatch: string | null = null
				let bestScore = Infinity

				// 🔧 Extract the table name from the SQL query to search in the correct table
				const tableMatch = sql.match(/FROM\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/i)
				let targetTable: string | null = null

				if (tableMatch) {
					const extractedTable = tableMatch[1]
					// Find the actual table name (case-insensitive)
					targetTable = Object.keys(schema.tables).find((t) => t.toLowerCase() === extractedTable.toLowerCase()) || null
				}

				console.log(`🔍 Searching for match for "${wrongCol}" in table "${targetTable || 'ALL'}"`)

				// Search only in the target table if found, otherwise search all
				const columnsToSearch = targetTable && schema.tables[targetTable] ? schema.tables[targetTable] : Object.values(schema.tables).flat()

				for (const col of columnsToSearch) {
					const colName = typeof col === 'string' ? col : col.name

					// Check exact case-insensitive match
					if (colName.toLowerCase() === wrongCol.toLowerCase()) {
						bestMatch = colName
						bestScore = 0
						break
					}

					// Check Levenshtein distance
					const dist = this.levenshteinDistance(colName.toLowerCase(), wrongCol.toLowerCase())
					if (dist < bestScore && dist <= 3) {
						bestScore = dist
						bestMatch = colName
					}

					// Snake_case to camelCase
					const snakeToCamel = wrongCol.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
					if (colName === snakeToCamel) {
						bestMatch = colName
						bestScore = 0
						break
					}

					// CamelCase to snake_case
					const camelToSnake = colName.replace(/([A-Z])/g, '_$1').toLowerCase()
					if (camelToSnake === wrongCol.toLowerCase()) {
						bestMatch = colName
						bestScore = 0
						break
					}
				}

				if (bestMatch) {
					console.log(`✅ Found match: "${wrongCol}" -> "${bestMatch}" (score: ${bestScore})`)

					// Replace all occurrences carefully
					// First, try to replace quoted versions
					fixed = fixed.replace(new RegExp(`"${wrongCol.replace(/"/g, '')}"`, 'g'), `"${bestMatch}"`)
					// Then unquoted versions (with word boundaries)
					fixed = fixed.replace(new RegExp(`\\b${wrongCol}\\b(?!")`, 'gi'), `"${bestMatch}"`)
				} else {
					console.log(`❌ No match found for "${wrongCol}"${targetTable ? ` in table "${targetTable}"` : ''}`)
					if (targetTable && schema.tables[targetTable]) {
						console.log('Available columns in this table:', schema.tables[targetTable].map((c) => c.name).join(', '))
					}
				}
			}
		}

		// Fix unknown tables
		if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
			const match = errorMessage.match(/relation "?([^"\s]+)"?/i)
			if (match) {
				const wrongTable = match[1]
				let bestMatch: string | null = null
				let bestScore = Infinity

				const allTables = Object.keys(schema.tables)

				for (const tableName of allTables) {
					if (tableName.toLowerCase() === wrongTable.toLowerCase()) {
						bestMatch = tableName
						bestScore = 0
						break
					}

					const dist = this.levenshteinDistance(tableName.toLowerCase(), wrongTable.toLowerCase())
					if (dist < bestScore && dist <= 3) {
						bestScore = dist
						bestMatch = tableName
					}

					const snakeToCamel = wrongTable.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
					if (tableName === snakeToCamel) {
						bestMatch = tableName
						bestScore = 0
						break
					}
				}

				if (bestMatch) {
					console.log(`✅ Found table match: "${wrongTable}" -> "${bestMatch}"`)
					fixed = fixed.replace(new RegExp(`"${wrongTable}"`, 'gi'), `"${bestMatch}"`)
					fixed = fixed.replace(new RegExp(`\\b${wrongTable}\\b(?!")`, 'gi'), `"${bestMatch}"`)
				}
			}
		}

		return this.smartQuoteIdentifiers(fixed, schema)
	}

	levenshteinDistance(str1: string, str2: string): number {
		const m = str1.length
		const n = str2.length
		const dp: number[][] = Array(m + 1)
			.fill(0)
			.map(() => Array(n + 1).fill(0))

		for (let i = 0; i <= m; i++) dp[i][0] = i
		for (let j = 0; j <= n; j++) dp[0][j] = j

		for (let i = 1; i <= m; i++) {
			for (let j = 1; j <= n; j++) {
				if (str1[i - 1] === str2[j - 1]) {
					dp[i][j] = dp[i - 1][j - 1]
				} else {
					dp[i][j] = Math.min(dp[i - 1][j - 1] + 1, dp[i][j - 1] + 1, dp[i - 1][j] + 1)
				}
			}
		}

		return dp[m][n]
	}

	smartQuoteIdentifiers(sql: string, schema: PGDBSchema): string {
		const identifiers = new Set<string>()
		Object.entries(schema.tables).forEach(([table, columns]) => {
			identifiers.add(table.toLowerCase())
			columns.forEach((col) => identifiers.add(col.name.toLowerCase()))
		})

		const keywords = new Set([
			'SELECT',
			'FROM',
			'WHERE',
			'ORDER',
			'BY',
			'GROUP',
			'HAVING',
			'JOIN',
			'ON',
			'AND',
			'OR',
			'ASC',
			'DESC',
			'LIMIT',
			'OFFSET',
			'AS',
			'INNER',
			'LEFT',
			'RIGHT',
			'OUTER',
			'FULL',
			'CROSS',
			'COUNT',
			'SUM',
			'AVG',
			'MAX',
			'MIN',
			'DISTINCT',
			'NULL',
			'IS',
			'NOT',
			'IN',
			'BETWEEN',
			'LIKE',
			'ILIKE',
			'NOW',
			'INTERVAL',
			'CAST',
			'CASE',
			'WHEN',
			'THEN',
			'ELSE',
			'END',
			'INSERT',
			'UPDATE',
			'DELETE',
			'INTO',
			'VALUES',
			'SET',
			'ALL',
			'ANY',
			'EXISTS',
			'UNION',
			'EXCEPT',
			'INTERSECT',
		])

		const tokens = sql.match(/("[^"]*"|'[^']*'|\d+\.?\d*|[a-zA-Z_][a-zA-Z0-9_]*|[<>=!]+|[^\w\s"']|\s+)/g) || []

		return tokens
			.map((token) => {
				const trimmed = token.trim()
				if (!trimmed) return token

				if (trimmed.startsWith('"') || trimmed.startsWith("'")) return token
				if (/^\d+\.?\d*$/.test(trimmed)) return token
				if (keywords.has(trimmed.toUpperCase())) return trimmed.toUpperCase()
				if (/^[<>=!+\-*/%(),;.[\]]+$/.test(trimmed)) return token

				if (identifiers.has(trimmed.toLowerCase())) {
					return `"${trimmed}"`
				}

				return token
			})
			.join('')
	}
}
