import { STATUS_CODE, type StatusCode } from '@std/http/status'
import { HttpError } from './utils.ts'

const pattern = new URLPattern('https://github.com/:owner/:repo/pull/:prId')

export type PrInfo = {
	// repoOwner: string
	repo: {
		owner: string
		label: string
		sha: string
	}
	commit: {
		label: string
		sha: string
	}
	title: string
	user: string
	changedSvgFiles: string[]
	htmlUrl: string
}

/**
 * @param pr The GitHub PR HTML URL, e.g. `https://github.com/jdecked/twemoji/pull/126`
 * @returns An object containing the list of changed SVG files and commit hashes
 */
export async function getPrInfo(pr: number | string | URL): Promise<PrInfo> {
	const htmlUrl = typeof pr === 'number'
		? `https://github.com/jdecked/twemoji/pull/${pr}`
		: pr.toString().replace(/\/+$/, '')
	const urlMatch = pattern.exec(htmlUrl)
	if (urlMatch == null) {
		throw new HttpError(STATUS_CODE.BadRequest, 'Invalid GitHub PR URL format')
	}

	const { owner, repo, prId } = urlMatch.pathname.groups as { owner: string; repo: string; prId: string }

	const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}`

	const [prData, changedSvgFiles] = await Promise.all([
		getBasePrInfo(apiUrl),
		getFilePaths(apiUrl),
	])

	return {
		user: prData.user.login,
		title: prData.title,
		htmlUrl,
		commit: {
			label: prData.head.label,
			sha: prData.head.sha,
		},
		repo: {
			owner,
			label: prData.base.label,
			sha: prData.base.sha,
		},
		changedSvgFiles,
	}
}

async function getBasePrInfo(apiUrl: string) {
	const res = await fetch(apiUrl)
	if (!res.ok) throw new HttpError(res.status as StatusCode, `Failed to fetch ${apiUrl}`)

	const data: {
		title: string
		head: {
			label: string
			sha: string
		}
		user: {
			login: string
		}
		base: {
			label: string
			sha: string
		}
	} = await res.json()

	return data
}

async function getFilePaths(apiUrl: string) {
	const files: { filename: string }[] = []

	let url: string | null = `${apiUrl}/files`

	while (url != null) {
		const res: Response = await fetch(url)
		if (!res.ok) throw new HttpError(res.status as StatusCode, `Failed to fetch ${url}`)
		files.push(...await res.json())
		url = res.headers.get('link')?.match(/<(?<next>[^>]+)>;\s*rel=(?<quot>['"])next\k<quot>/)?.groups?.next ?? null
	}

	return files
		.filter((file) => file.filename.startsWith('assets/svg/'))
		.map((file) => file.filename)
}
