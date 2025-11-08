import { HttpSaver } from '@li/http-saver'
import { serveDir } from '@std/http/file-server'
import { getPrInfo, type PrInfo } from './gh.ts'
import { HttpError } from './utils.ts'
import { STATUS_CODE } from '@std/http/status'
import { typeByExtension } from '@std/media-types/type-by-extension'
import Handlebars from 'handlebars'

const html = await Deno.readTextFile('./src/client/index.html')
const template = Handlebars.compile(html)

Deno.serve(async (req) => {
	const url = new URL(req.url)
	const IS_DEV = Boolean(url.port)

	switch (url.pathname) {
		case '/': {
			const _pr = url.searchParams.get('pr')
			const pr = _pr == null ? null : !/\D/.test(_pr) ? Number(_pr) : new URL(_pr)
			try {
				using _ = IS_DEV ? (new HttpSaver().stubFetch()) : { [Symbol.dispose]() {} }
				return new Response(
					template(await getTemplateProps(pr)),
					{ headers: { 'content-type': typeByExtension('html')! } },
				)
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

async function getTemplateProps(pr: number | URL | null) {
	const prInfo = await getPrInfoOrDefault(pr)
	const { title, htmlUrl, changedSvgFiles } = prInfo

	const emojis = changedSvgFiles.map((filePath) => {
		const m = filePath.match(/\/(?<icon>[^/.]+)\.\w+$/)
		if (m?.groups == null) return null
		return m.groups.icon
			.split('-')
			.map((cp) => String.fromCodePoint(parseInt(cp, 16)))
			.join('')
	}).filter((emoji) => emoji != null)

	return {
		...prInfo,
		emojisJson: JSON.stringify(emojis),
		incomingContent: [`Check out my PR [${title}](${htmlUrl})!`, emojis.join('')].filter(Boolean).join('\n\n'),
		replyContent: getReplyContent(emojis),
		subtitle: title,
	}
}

async function getPrInfoOrDefault(pr: number | URL | null): Promise<PrInfo> {
	if (pr == null) {
		// Simulate loading delay for demo
		await new Promise((resolve) => setTimeout(resolve, 1500))
		return {
			title: 'Example PR',
			user: 'example-user',
			htmlUrl: 'https://example.com/',
			commit: {
				label: 'example-user:example-branch',
				sha: 'latest',
			},
			repo: {
				owner: 'jdecked',
				label: 'jdecked:main',
				sha: 'latest',
			},
			changedSvgFiles: '🥳,👻,🐉,👩🏽‍🔧'.split(',')
				.map((m) => `/assets/svg/${[...m].map((c) => c.codePointAt(0)?.toString(16)).join('-')}.svg`),
		}
	}

	return getPrInfo(pr)
}

function getReplyContent(emojis: string[]) {
	switch (emojis.length) {
		case 0:
			return 'No SVG emojis were added or modified in this PR.'
		case 1:
			return `Here is the emoji before:\n\n${emojis.join('')}`
		default:
			return `Here are the emojis before:\n\n${emojis.join('')}`
	}
}
