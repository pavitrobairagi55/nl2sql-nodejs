import { IAIProvider } from "../../interfaces/IAIProvider";
import { AnyData } from "../../utils/utils";

export class OllamaProvider implements IAIProvider {
  private model: string;
  private baseUrl: string;

  constructor(
    model: string = 'llama3.2',
    baseUrl: string = 'http://localhost:11434'
  ) {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async generateSQL(
    naturalLanguageQuery: string,
    schema: string
  ): Promise<string> {
    const prompt = this.buildPrompt(naturalLanguageQuery, schema);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.extractSQL(data.response);
    } catch (error: AnyData) {
      throw new Error(`Failed to generate SQL: ${error.message}`);
    }
  }

  private buildPrompt(query: string, schema: string): string {
    return `You are a SQL expert. Given the following database schema and a natural language query, generate ONLY the SQL query without any explanation or markdown formatting.

Database Schema:
${schema}

Natural Language Query: ${query}

Generate the SQL query:`;
  }

  private extractSQL(response: string): string {
    // Remove markdown code blocks if present
    let sql = response.trim();
    sql = sql.replace(/```sql\n?/g, '');
    sql = sql.replace(/```\n?/g, '');
    sql = sql.trim();

    // Remove any explanatory text before the SQL
    const lines = sql.split('\n');
    const sqlLines = lines.filter((line) => {
      const trimmed = line.trim().toUpperCase();
      return (
        trimmed.startsWith('SELECT') ||
        trimmed.startsWith('INSERT') ||
        trimmed.startsWith('UPDATE') ||
        trimmed.startsWith('DELETE') ||
        trimmed.startsWith('WITH') ||
        (line.trim() && !trimmed.match(/^(HERE|THE|THIS)/))
      );
    });

    return sqlLines.join('\n').trim();
  }
}
