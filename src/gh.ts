const pattern = new URLPattern('https://github.com/:owner/:repo/pull/:prId')

export type PrInfo = {
	repoOwner: string
	title: string
	user: string
	changedSvgFiles: string[]
	commitHash: string
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
	if (!urlMatch) {
		throw new Error('Invalid GitHub PR URL format')
	}

	const { owner, repo, prId } = urlMatch.pathname.groups

	const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}`

	const [{ commitHash, title, user }, changedSvgFiles] = await Promise.all([
		getBasePrInfo(apiUrl),
		getFilePaths(apiUrl),
	])

	return { repoOwner: owner!, title, commitHash, user, changedSvgFiles, htmlUrl }
}

async function getBasePrInfo(apiUrl: string) {
	const res = await fetch(apiUrl)
	if (!res.ok) throw new Error(`Failed to fetch ${apiUrl}: ${res.status}`)

	const data: { title: string; head: { sha: string }; user: { login: string } } = await res.json()

	return {
		commitHash: data.head.sha,
		title: data.title,
		user: data.user.login,
	}
}

async function getFilePaths(apiUrl: string) {
	apiUrl += '/files'
	const res = await fetch(apiUrl)
	if (!res.ok) throw new Error(`Failed to fetch ${apiUrl}: ${res.status}`)

	const files: { filename: string }[] = await res.json()

	return files
		.filter((file) => file.filename.startsWith('assets/svg/'))
		.map((file) => file.filename)
}
