import type { StatusCode } from '@std/http/status'

export class HttpError extends Error {
	code: StatusCode
	constructor(status: StatusCode, message: string) {
		super(message)
		this.code = status
	}
}
