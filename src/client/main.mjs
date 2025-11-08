// @ts-check
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

// @ts-types="./vendor/twemoji.d.ts"
import twemoji from 'twemoji'

/** @typedef {{ base: string; folder: string; ext: string; }} Config */

initThemeToggle()

const RGI_REGEX = /\p{RGI_Emoji}/v

const $target = document.querySelector('#target')

// Show loading spinner
function showLoadingSpinner() {
	const $loadingDiv = document.createElement('div')
	$loadingDiv.className = 'loading-spinner'
	$loadingDiv.innerHTML = '<div class="spinner"></div>'
	assert($target instanceof HTMLElement)
	$target.appendChild($loadingDiv)
	return $loadingDiv
}

// Show loading spinner
const loadingSpinner = showLoadingSpinner()

// Remove loading spinner
loadingSpinner.remove()

const $template = document.querySelector('#twemoji-card')

class TwemojiCard extends HTMLElement {
	#ac = new AbortController()

	constructor() {
		super()

		assert($template instanceof HTMLTemplateElement)
		this.attachShadow({ mode: 'open' })
		this.shadowRoot?.append($template.content.cloneNode(true))
	}

	static observedAttributes = ['version', 'content', 'user', 'match-mode', 'emojis']
	static {
		for (const attr of this.observedAttributes) {
			// kebab-case -> camelCase
			const prop = attr.replaceAll(/-([a-z])/g, (_, c) => c.toUpperCase())
			Object.defineProperty(this.prototype, prop, {
				get() {
					return this.getAttribute(attr) ?? ''
				},
				set(value) {
					this.setAttribute(attr, value)
				},
			})
		}
	}

	connectedCallback() {
		this.#ac = new AbortController()

		this.hidden = true
		const $stylesheet = this.shadowRoot?.querySelector('link[rel=stylesheet]')
		assert($stylesheet instanceof HTMLLinkElement)
		if ($stylesheet.sheet != null) {
			this.hidden = false
		} else {
			$stylesheet.addEventListener('load', () => {
				this.hidden = false
			})
		}

		this.#render()
		this.#setupEventListeners()
	}

	disconnectedCallback() {
		this.#ac.abort()
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
		const { signal } = this.#ac
		const $content = this.shadowRoot?.querySelector('.content')
		assert($content instanceof HTMLElement)
		$content.addEventListener('click', this.#handleContentClick.bind(this), { signal })
	}

	/** @param {MouseEvent} e */
	#handleContentClick(e) {
		if (e.target instanceof Element && e.target.closest('a')) return

		const $content = this.shadowRoot?.querySelector('.content')
		assert($content instanceof HTMLElement)
		if ($content.classList.contains('editing')) return

		const { signal } = this.#ac

		const currentContent = this.getAttribute('content') || ''

		const textarea = document.createElement('textarea')
		textarea.value = currentContent
		textarea.addEventListener('blur', this.#handleTextareaBlur.bind(this), { signal })
		textarea.addEventListener('keydown', this.#handleTextareaKeydown.bind(this), { signal })

		$content.textContent = ''
		$content.appendChild(textarea)
		$content.classList.add('editing')

		textarea.focus()
		textarea.select()
	}

	/** @param {FocusEvent} e */
	#handleTextareaBlur(e) {
		const textarea = /** @type {HTMLTextAreaElement} */ (e.target)
		// Update the content attribute, which will trigger re-rendering
		this.setAttribute('content', textarea.value)
	}

	/** @param {KeyboardEvent} e */
	#handleTextareaKeydown(e) {
		if (e.key === 'Escape') {
			const textarea = /** @type {HTMLTextAreaElement} */ (e.target)
			textarea.blur()
		}
	}

	#render() {
		const content = this.getAttribute('content') || ''
		const user = this.getAttribute('user') || ''

		const $user = this.shadowRoot?.querySelector('.user')
		assert($user instanceof HTMLElement)
		$user.textContent = user

		const $content = this.shadowRoot?.querySelector('.content')
		assert($content instanceof HTMLElement)
		$content.classList.remove('editing')
		$content.innerHTML = this.#parseToHtml(content)
	}

	/**
	 * @param {string} content
	 * @returns {string}
	 */
	#parseToHtml(content) {
		return escapeHtml(content)
			.replaceAll(
				/\[(?<text>.+?)\]\((?<url>.+?)\)/g,
				'<a href="$<url>" target="_blank" rel="noopener noreferrer">$<text></a>',
			)
			.replaceAll(/(?<=>|^)[^<>]+(?=<|$)/g, (m) => this.#parseEmojis(m))
	}

	/** @param {string} m */
	#parseEmojis(m) {
		const version = this.getAttribute('version') || 'latest'

		let regex

		switch (this.getAttribute('match-mode')) {
			case 'rgi': {
				regex = new RegExp(RGI_REGEX, 'gv')
				break
			}
			case 'rgi-incoming': {
				regex = new RegExp(
					[
						...[...JSON.parse(this.getAttribute('emojis') ?? '[]')]
							.sort((a, b) => b.length - a.length)
							.map((x) => RegExp.escape(x)),
						RGI_REGEX.source,
					].join('|'),
					'gv',
				)
				break
			}
		}

		return twemoji.parse(m, { ...getConfig(version), regex })
	}
}

customElements.define('twemoji-card', TwemojiCard)

function initThemeToggle() {
	const $themeToggle = document.querySelector('#theme-toggle')
	assert($themeToggle instanceof HTMLElement)
	const $icon = $themeToggle.querySelector('.theme-toggle-icon')

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

		assert($icon instanceof HTMLElement)
		$icon.innerHTML = twemoji.parse(resolvedTheme === 'light' ? '🌞' : '🌜')

		if (newTheme != null) localStorage.setItem('theme', newTheme)
		applyTheme(resolvedTheme)
	}

	function toggleTheme() {
		const resolvedTheme = getResolvedTheme(getSavedTheme())

		setTheme(resolvedTheme === 'light' ? 'dark' : 'light')
	}

	$themeToggle.addEventListener('click', () => {
		toggleTheme()
	})
}

const $emojiForm = document.querySelector('#emoji-form')
assert($emojiForm instanceof HTMLFormElement)
const $emojiSizeSlider = $emojiForm.querySelector('[name=emoji-size-slider]')
assert($emojiSizeSlider instanceof HTMLInputElement)

for (const $el of $emojiForm.querySelectorAll('[disabled]')) {
	$el.removeAttribute('disabled')
}

/** @param {number} size */
function updateSize(size) {
	const style = `${size}em`

	for (const $el of document.querySelectorAll('twemoji-card')) {
		assert($el instanceof HTMLElement)
		$el.style.setProperty('--emoji-size', style)
	}

	assert($emojiSizeSlider instanceof HTMLInputElement)
	$emojiSizeSlider.value = size.toString()
	const $label = $emojiSizeSlider.closest('label')?.querySelector('span')
	assert($label instanceof HTMLElement)
	$label.textContent = size.toString()
}

$emojiSizeSlider.addEventListener('input', function () {
	const size = parseFloat(this.value)
	updateSize(size)
})

$emojiForm.addEventListener('change', (e) => {
	const { target } = e
	if (!(target instanceof HTMLInputElement) || target.name !== 'emoji-match-mode') return

	const { value } = target

	for (const $el of document.querySelectorAll('twemoji-card')) {
		assert($el instanceof HTMLElement)
		$el.setAttribute('match-mode', value)
	}
})

/**
 * @param {string} tag
 * @returns {Config}
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

/** @param {string} str */
function escapeHtml(str) {
	return str.replaceAll(/[<>&"']/g, (m) => `&#${m.codePointAt(0)};`)
}
