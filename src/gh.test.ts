import { HttpSaver } from '@li/http-saver'
import { getPrInfo } from './gh.ts'
import { assertEquals } from '@std/assert'

Deno.test(getPrInfo.name, async () => {
	using _ = new HttpSaver().stubFetch()

	const prId = 126
	const href = `https://github.com/jdecked/twemoji/pull/${prId}`
	for (
		const input of [
			prId,
			href,
			new URL(href),
			`${href}/`,
		]
	) {
		const result = await getPrInfo(input)

		assertEquals(result, {
			title: "Make the face mask emoji's mask look more like a real face mask",
			commitHash: 'a283544d5c2ccf90b0fedc506bdf9025bbc020ef',
			changedSvgFiles: ['assets/svg/1f637.svg'],
			repoOwner: 'jdecked',
			user: 'HeyIgna',
			htmlUrl: 'https://github.com/jdecked/twemoji/pull/126',
		})
	}
})
