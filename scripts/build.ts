import { fromFileUrl, join, relative } from '@std/path'

const IN_DIR = '../twemoji'
const OUT_DIR = './src/client/vendor'

const copyFiles = {
	'index.d.ts': 'twemoji.d.ts',
	'dist/twemoji.esm.js': 'twemoji.mjs',
}

await new Deno.Command('npm', {
	args: ['run', 'build'],
	cwd: IN_DIR,
}).spawn().output()

for (const [src, dest] of Object.entries(copyFiles)) {
	await Deno.copyFile(join(IN_DIR, src), join(OUT_DIR, dest))
}

const [remoteName, branch] = await new Deno.Command('git', {
	args: ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
	cwd: IN_DIR,
	stdout: 'piped',
}).spawn().output().then((res) => new TextDecoder().decode(res.stdout).trim().split('/'))

const remote = await new Deno.Command('git', {
	args: ['remote', 'get-url', remoteName],
	cwd: IN_DIR,
	stdout: 'piped',
}).spawn().output().then((res) => new TextDecoder().decode(res.stdout).trim())

const sha = await new Deno.Command('git', {
	args: ['rev-parse', 'HEAD'],
	cwd: IN_DIR,
	stdout: 'piped',
}).spawn().output().then((res) => new TextDecoder().decode(res.stdout).trim())

const buildInfo = {
	ts: new Date().toISOString(),
	buildScript: relative(Deno.cwd(), fromFileUrl(import.meta.url)),
	remote,
	branch,
	sha,
	license: 'https://github.com/jdecked/twemoji/blob/main/LICENSE',
}

await Deno.writeTextFile(
	join(OUT_DIR, 'build-info.json'),
	JSON.stringify(buildInfo, null, '\t') + '\n',
)

await new Deno.Command(Deno.execPath(), {
	args: ['fmt', OUT_DIR],
}).spawn().output()
