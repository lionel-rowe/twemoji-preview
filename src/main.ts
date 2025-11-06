import { serveDir } from '@std/http/file-server'
import { getPrInfo } from './gh.ts'

Deno.serve(async (req) => {
	const url = new URL(req.url)
	switch (url.pathname) {
		case '/api/pr': {
			const _pr = url.searchParams.get('pr')

			if (_pr == null) {
				return Response.json({ error: 'Missing "pr" query parameter' }, { status: 400 })
			}

			const pr = !/\D/.test(_pr) ? Number(_pr) : new URL(_pr)

			return Response.json(await getPrInfo(pr))
		}
	}

	return serveDir(req, { fsRoot: './src/client' })
})
