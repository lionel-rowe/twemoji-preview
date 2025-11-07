import { HttpSaver } from '@li/http-saver'
import { serveDir } from '@std/http/file-server'
import { getPrInfo } from './gh.ts'
import { HttpError } from './utils.ts'
import { STATUS_CODE } from '@std/http/status'

Deno.serve(async (req) => {
	const url = new URL(req.url)
	const IS_DEV = Boolean(url.port)

	switch (url.pathname) {
		case '/api/pr': {
			const _pr = url.searchParams.get('pr')

			if (_pr == null) {
				return Response.json({ error: 'Missing "pr" query parameter' }, { status: STATUS_CODE.BadRequest })
			}

			const pr = !/\D/.test(_pr) ? Number(_pr) : new URL(_pr)

			try {
				using _ = IS_DEV ? (new HttpSaver().stubFetch()) : { [Symbol.dispose]() {} }

				return Response.json(await getPrInfo(pr))
			} catch (err) {
				if (err instanceof HttpError) {
					return Response.json({ error: err.message }, { status: err.code })
				}

				throw err
			}
		}
	}

	return serveDir(req, { fsRoot: './src/client' })
})
