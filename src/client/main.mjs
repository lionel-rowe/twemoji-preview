// @ts-check
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

/** @typedef {import('@twemoji/api').Twemoji} Twemoji */
/** @typedef {import('@twemoji/api').TwemojiOptions} TwemojiOptions */
const twemoji = /** @type {typeof globalThis & { twemoji: Twemoji }} */ (globalThis).twemoji

import snarkdown from 'https://cdn.jsdelivr.net/npm/snarkdown@2.0.0/dist/snarkdown.es.js'

initThemeToggle()

/** @returns {Promise<import('../gh.ts').PrInfo>} */
async function getPrInfo() {
	const url = new URL('/api/pr', location.href)
	const pr = new URLSearchParams(location.search).get('pr')

	if (pr == null) {
		// Simulate loading delay for demo
		await new Promise((resolve) => setTimeout(resolve, 1500))
		return {
			repoOwner: 'jdecked',
			title: 'Demo PR',
			commitHash: 'latest',
			user: 'demo-user',
			changedSvgFiles: [...'🥳👻🐉👩🏽‍🔧'.match(/\p{RGI_Emoji}/gv) ?? []]
				.map((m) => `/assets/svg/${[...m].map((c) => c.codePointAt(0)?.toString(16)).join('-')}.svg`),
			htmlUrl: 'https://example.com/',
		}
	}

	url.searchParams.set('pr', pr)

	return await (await fetch(url)).json()
}

// Get target element early
const $target = document.querySelector('#target')

// Show loading spinner
function showLoadingSpinner() {
	const loadingDiv = document.createElement('div')
	loadingDiv.className = 'loading-spinner'
	loadingDiv.innerHTML = '<div class="spinner"></div>'
	assert($target instanceof HTMLElement)
	$target.appendChild(loadingDiv)
	return loadingDiv
}

// Show loading spinner
const loadingSpinner = showLoadingSpinner()

// Fetch data
const { repoOwner, title, commitHash, user, changedSvgFiles, htmlUrl } = await getPrInfo()

// Remove loading spinner
loadingSpinner.remove()

const emojis = changedSvgFiles.map((filePath) => {
	const m = filePath.match(/\/(?<dashed>[^/.]+)\.\w+$/)
	if (m?.groups == null) return null
	return m.groups.dashed
		.split('-')
		.map((cp) => String.fromCodePoint(parseInt(cp, 16)))
		.join('')
}).filter((emoji) => emoji != null)

const $template = document.querySelector('#social-media-post')

class SocialMediaPost extends HTMLElement {
	constructor() {
		super()
		assert($template instanceof HTMLTemplateElement)
		this.attachShadow({ mode: 'open' })
		this.shadowRoot?.append($template.content.cloneNode(true))

		// Bind methods to preserve context
		this.handleContentClick = this.handleContentClick.bind(this)
		this.handleTextareaBlur = this.handleTextareaBlur.bind(this)
		this.handleTextareaKeydown = this.handleTextareaKeydown.bind(this)
	}

	static observedAttributes = ['version', 'content', 'user']

	connectedCallback() {
		this.#render()
		this.#setupEventListeners()
	}

	disconnectedCallback() {
		this.#removeEventListeners()
	}

	/**
	 * @param {string} _name
	 * @param {string | null} _oldValue
	 * @param {string | null} _newValue
	 */
	attributeChangedCallback(_name, _oldValue, _newValue) {
		this.#render()
	}

	#setupEventListeners() {
		const contentDisplay = this.shadowRoot?.querySelector('.content')
		assert(contentDisplay instanceof HTMLElement)
		contentDisplay.addEventListener('click', this.handleContentClick)
	}

	#removeEventListeners() {
		const contentDisplay = this.shadowRoot?.querySelector('.content')
		assert(contentDisplay instanceof HTMLElement)
		contentDisplay.removeEventListener('click', this.handleContentClick)
	}

	handleContentClick() {
		const contentDisplay = this.shadowRoot?.querySelector('.content')
		assert(contentDisplay instanceof HTMLElement)
		if (contentDisplay.classList.contains('editing')) return

		const currentContent = this.getAttribute('content') || ''

		const textarea = document.createElement('textarea')
		textarea.value = currentContent
		textarea.addEventListener('blur', this.handleTextareaBlur)
		textarea.addEventListener('keydown', this.handleTextareaKeydown)

		contentDisplay.textContent = ''
		contentDisplay.appendChild(textarea)
		contentDisplay.classList.add('editing')

		textarea.focus()
		textarea.select()
	}

	/** @param {Event} e */
	handleTextareaBlur(e) {
		const textarea = /** @type {HTMLTextAreaElement} */ (e.target)
		// Update the content attribute, which will trigger re-rendering
		this.setAttribute('content', textarea.value)
	}

	/** @param {KeyboardEvent} e */
	handleTextareaKeydown(e) {
		if (e.key === 'Escape') {
			const textarea = /** @type {HTMLTextAreaElement} */ (e.target)
			textarea.blur()
		}
	}

	#render() {
		const content = this.getAttribute('content') || ''
		const user = this.getAttribute('user') || ''

		const userDisplay = this.shadowRoot?.querySelector('.user')
		assert(userDisplay instanceof HTMLElement)
		userDisplay.textContent = user

		const contentDisplay = this.shadowRoot?.querySelector('.content')
		assert(contentDisplay instanceof HTMLElement)
		contentDisplay.classList.remove('editing')
		contentDisplay.innerHTML = this.#parse(content)
		for (const a of contentDisplay.querySelectorAll('a')) {
			a.target = '_blank'
			a.rel = 'noopener noreferrer'
		}
	}

	/**
	 * @param {string} html
	 * @returns {string}
	 */
	#parse(html) {
		const version = this.getAttribute('version') || 'latest'
		const config = getConfig(version)

		return snarkdown(html)
			.replaceAll(/<(?!a\s|\/a>)/gi, '&lt;')
			.replaceAll(/(?<=>|^)[^<>]+(?=<|$)/g, (m) => twemoji.parse(m, config))
	}
}

customElements.define('social-media-post', SocialMediaPost)

const currentPost = document.createElement('social-media-post')
currentPost.setAttribute('user', repoOwner)
currentPost.setAttribute(
	'content',
	`Here ${emojis.length === 1 ? 'is the emoji' : 'are the emojis'} before:\n${emojis.join('')}`,
)

const prPost = document.createElement('social-media-post')
prPost.setAttribute('version', commitHash)
prPost.setAttribute('user', user)
prPost.setAttribute('content', `Check out my PR [${title}](${htmlUrl})!\n${emojis.join('')}`)

assert($target instanceof HTMLElement)
$target.appendChild(currentPost)
$target.appendChild(prPost)

function initThemeToggle() {
	const themeToggle = document.querySelector('#theme-toggle')
	assert(themeToggle instanceof HTMLElement)
	const icon = themeToggle.querySelector('.theme-toggle-icon')

	const getSavedTheme = () => /** @type {'light' | 'dark' | null} */ (localStorage.getItem('theme') ?? null)

	/** @param {'light' | 'dark'} theme */
	function applyTheme(theme) {
		if (theme == null) {
			document.documentElement.removeAttribute('data-theme')
		} else {
			document.documentElement.setAttribute('data-theme', theme)
		}
	}

	setTheme(null)

	globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		setTheme(null)
	})

	/** @param {"light" | "dark" | null} newTheme */
	function getResolvedTheme(newTheme) {
		return newTheme == null
			? (globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
			: newTheme
	}

	/** @param {"light" | "dark" | null} newTheme */
	function setTheme(newTheme) {
		const resolvedTheme = getResolvedTheme(newTheme ?? getSavedTheme())

		assert(icon instanceof HTMLElement)
		icon.innerHTML = twemoji.parse(resolvedTheme === 'light' ? '🌞' : '🌜')

		if (newTheme != null) localStorage.setItem('theme', newTheme)
		applyTheme(resolvedTheme)
	}

	function toggleTheme() {
		const resolvedTheme = getResolvedTheme(getSavedTheme())

		setTheme(resolvedTheme === 'light' ? 'dark' : 'light')
	}

	themeToggle.addEventListener('click', () => {
		toggleTheme()
	})
}

const $emojiSizeSlider = document.querySelector('#emoji-size-slider')
assert($emojiSizeSlider instanceof HTMLInputElement)
$emojiSizeSlider.disabled = false

$emojiSizeSlider.addEventListener('input', function () {
	const size = `${parseFloat(this.value)}em`

	for (const $el of document.querySelectorAll('social-media-post')) {
		assert($el instanceof HTMLElement)
		$el.style.setProperty('--emoji-size', size)
	}
})

/**
 * @param {string} tag
 * @returns {TwemojiOptions}
 */
function getConfig(tag) {
	return {
		base: `https://cdn.jsdelivr.net/gh/jdecked/twemoji@${tag}/assets/`,
		folder: 'svg',
		ext: '.svg',
	}
}

/**
 * Asserts that a condition is true.
 * @param {unknown} condition
 * @returns {asserts condition}
 */
function assert(condition) {
	if (!condition) {
		throw new Error('Assertion failed')
	}
}
