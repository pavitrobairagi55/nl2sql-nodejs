export interface IAIProvider {
  generateSQL(naturalLanguageQuery: string, schema: string): Promise<string>;
}