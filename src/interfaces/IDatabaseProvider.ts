export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields?: any[];
}

export interface IDatabaseProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery(query: string): Promise<QueryResult>;
  getSchema(): Promise<string>;
}
