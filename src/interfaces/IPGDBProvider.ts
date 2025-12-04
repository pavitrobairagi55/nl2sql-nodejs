export interface ColumnInfo {
	name: string
}

export interface TableSchema {
	[tableName: string]: ColumnInfo[]
}

export interface PGDBSchema {
	tables: TableSchema
}

export interface ColumnDefinition {
	name: string
	type: string
	nullable: boolean
	default: string | null
}

export interface ForeignKeyInfo {
	table_name: string
	column_name: string
	foreign_table_name: string
	foreign_column_name: string
}

export interface ExtractedSchema {
	tables: TableSchema
	foreignKeys: ForeignKeyInfo[]
}
