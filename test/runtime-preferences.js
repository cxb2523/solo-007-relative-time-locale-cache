import {assert} from '@open-wc/testing'
import '../src/index.ts'
import {dateTimeFormat} from '../src/intl-cache.ts'

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

suite('runtime locale & timezone updates', function () {
  teardown(function () {
    document.documentElement.removeAttribute('lang')
    document.documentElement.removeAttribute('time-zone')
    document.documentElement.removeAttribute('hour-cycle')
    for (const el of document.querySelectorAll('relative-time')) el.remove()
  })

  test('re-renders mounted elements when the document lang changes', async function () {
    document.documentElement.lang = 'en'
    const el = document.createElement('relative-time')
    el.setAttribute('datetime', new Date(Date.now() - 3 * 60 * 1000).toISOString())
    document.body.appendChild(el)
    await tick()
    const english = el.shadowRoot.textContent
    assert.match(english, /3 minutes ago/)

    document.documentElement.lang = 'es'
    await tick()
    const spanish = el.shadowRoot.textContent
    assert.notEqual(spanish, english)
    assert.match(spanish, /hace 3 minutos/)
  })

  test('languagechange event invalidates caches and updates mounted elements', async function () {
    const cached = dateTimeFormat('en', {hour: 'numeric'})
    const el = document.createElement('relative-time')
    el.setAttribute('datetime', new Date().toISOString())
    document.body.appendChild(el)
    await tick()

    let updates = 0
    const original = el.update
    el.update = function () {
      updates += 1
      return original.call(this)
    }
    window.dispatchEvent(new Event('languagechange'))
    assert.isAbove(updates, 0, 'mounted element re-renders on languagechange')
    assert.notEqual(dateTimeFormat('en', {hour: 'numeric'}), cached, 'cached formatters are dropped')
  })

  test('re-renders mounted elements when the document time-zone changes', async function () {
    document.documentElement.setAttribute('time-zone', 'Asia/Tokyo')
    const el = document.createElement('relative-time')
    el.setAttribute('lang', 'en-US')
    el.setAttribute('format', 'datetime')
    el.setAttribute('hour', 'numeric')
    el.setAttribute('minute', '2-digit')
    el.setAttribute('time-zone-name', 'shortOffset')
    el.setAttribute('datetime', '2024-06-01T12:00:00.000Z')
    document.body.appendChild(el)
    await tick()
    const tokyo = el.shadowRoot.textContent
    assert.match(tokyo, /GMT\+9/)

    document.documentElement.setAttribute('time-zone', 'America/New_York')
    await tick()
    const newYork = el.shadowRoot.textContent
    assert.match(newYork, /GMT-4/)
    assert.notEqual(newYork, tokyo)
  })

  test('cache keys separate locale, time-zone and options', async function () {
    const tokyo = dateTimeFormat('en', {hour: 'numeric', timeZone: 'Asia/Tokyo'})
    assert.notEqual(dateTimeFormat('en', {hour: 'numeric', timeZone: 'UTC'}), tokyo)
    assert.notEqual(dateTimeFormat('en', {hour: 'numeric'}), tokyo)
    assert.notEqual(dateTimeFormat('en', {hour: 'numeric', minute: 'numeric', timeZone: 'Asia/Tokyo'}), tokyo)
    assert.notEqual(dateTimeFormat('fr', {hour: 'numeric', timeZone: 'Asia/Tokyo'}), tokyo)
    assert.equal(dateTimeFormat('en', {hour: 'numeric', timeZone: 'Asia/Tokyo'}), tokyo)
  })
})

suite('invalid datetime handling', function () {
  teardown(function () {
    for (const el of document.querySelectorAll('relative-time')) el.remove()
  })

  test('missing datetime renders no Invalid Date text', async function () {
    const el = document.createElement('relative-time')
    document.body.appendChild(el)
    await tick()
    assert.notMatch(el.shadowRoot.textContent, /Invalid Date/)
    assert.equal(el.getAttribute('title'), null)
  })

  test('unparseable datetime falls back to light-dom text and keeps the raw value in title', async function () {
    const el = document.createElement('relative-time')
    el.textContent = 'a while back'
    el.setAttribute('datetime', 'Invalid')
    document.body.appendChild(el)
    await tick()
    assert.equal(el.shadowRoot.textContent, 'a while back')
    assert.equal(el.getAttribute('title'), 'Invalid')
  })

  test('unparseable datetime without content renders the raw value instead of Invalid Date', async function () {
    const el = document.createElement('relative-time')
    el.setAttribute('datetime', 'not-a-date')
    document.body.appendChild(el)
    await tick()
    assert.notMatch(el.shadowRoot.textContent, /Invalid Date/)
    assert.equal(el.shadowRoot.textContent, 'not-a-date')
    assert.equal(el.getAttribute('title'), 'not-a-date')
  })

  test('date-only datetime renders a readable date', async function () {
    const el = document.createElement('relative-time')
    el.setAttribute('lang', 'en-US')
    el.setAttribute('format', 'datetime')
    el.setAttribute('datetime', '2024-01-01')
    document.body.appendChild(el)
    await tick()
    const text = el.shadowRoot.textContent
    assert.notMatch(text, /Invalid Date/)
    assert.match(text, /\b20\d{2}\b/)
  })
})

suite('attribute hot updates', function () {
  teardown(function () {
    for (const el of document.querySelectorAll('relative-time')) el.remove()
  })

  test('datetime, format and tense changes re-render after connection', async function () {
    const el = document.createElement('relative-time')
    el.setAttribute('lang', 'en-US')
    document.body.appendChild(el)

    el.setAttribute('datetime', new Date(Date.now() - 3 * 60 * 1000).toISOString())
    await tick()
    assert.equal(el.shadowRoot.textContent, '3 minutes ago')

    el.setAttribute('datetime', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    await tick()
    assert.equal(el.shadowRoot.textContent, '2 hours ago')

    el.setAttribute('format', 'datetime')
    await tick()
    const absolute = el.shadowRoot.textContent
    assert.notEqual(absolute, '2 hours ago')
    assert.match(absolute, /[A-Z][a-z]{2} \d{1,2}/)

    el.setAttribute('format', 'relative')
    el.setAttribute('tense', 'future')
    await tick()
    assert.equal(el.shadowRoot.textContent, 'now')
  })
})
