import { Request, Response } from 'express'
import { TextToSQLService } from '../services/TextToSQLService'
import { AnyData } from '../utils/utils'

export class QueryController {
	constructor(private textToSQLService: TextToSQLService) {}

	async handleQuery(req: Request, res: Response): Promise<void> {
		try {
			const { query } = req.body

			if (!query || typeof query !== 'string') {
				res.status(400).json({
					error: 'Query is required and must be a string',
				})
				return
			}

			const result = await this.textToSQLService.processQuery(query)

			res.status(200).json({
				success: true,
				data: result,
			})
		} catch (error: AnyData) {
			console.error('Query processing error:', error)
			res.status(500).json({
				success: false,
				error: error.message,
			})
		}
	}
}
