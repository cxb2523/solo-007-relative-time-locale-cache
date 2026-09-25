import {assert} from '@open-wc/testing'
import '../src/index.ts'

suite('runtime locale/timezone updates', function () {
  let fixture

  suiteSetup(() => {
    fixture = document.createElement('div')
    document.body.appendChild(fixture)
    document.documentElement.lang = 'en'
  })

  suiteTeardown(() => {
    fixture.remove()
    document.documentElement.removeAttribute('lang')
    document.documentElement.removeAttribute('time-zone')
  })

  teardown(() => {
    fixture.innerHTML = ''
    document.documentElement.lang = 'en'
    document.documentElement.removeAttribute('time-zone')
  })

  const nextTask = () => new Promise(resolve => setTimeout(resolve, 0))
  const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  test('re-renders all mounted elements when the document lang changes', async () => {
    const one = document.createElement('relative-time')
    const two = document.createElement('relative-time')
    one.setAttribute('datetime', daysAgo(3))
    two.setAttribute('datetime', daysAgo(3))
    fixture.append(one, two)
    await Promise.resolve()
    const beforeOne = one.shadowRoot.textContent
    const beforeTwo = two.shadowRoot.textContent
    assert.equal(beforeOne, '3 days ago')
    assert.equal(beforeTwo, '3 days ago')
    document.documentElement.lang = 'es'
    await nextTask()
    const afterOne = one.shadowRoot.textContent
    const afterTwo = two.shadowRoot.textContent
    assert.equal(afterOne, 'hace 3 días')
    assert.equal(afterTwo, 'hace 3 días')
    console.log(`[locale-switch] mounted#1 "${beforeOne}" -> "${afterOne}" | mounted#2 "${beforeTwo}" -> "${afterTwo}"`)
  })

  test('re-renders mounted elements when languagechange fires', async () => {
    const el = document.createElement('relative-time')
    el.setAttribute('datetime', daysAgo(3))
    fixture.appendChild(el)
    await Promise.resolve()
    const before = el.shadowRoot.textContent
    document.documentElement.lang = 'fr'
    window.dispatchEvent(new Event('languagechange'))
    await nextTask()
    const after = el.shadowRoot.textContent
    assert.equal(after, 'il y a 3 jours')
    console.log(`[languagechange-event] "${before}" -> "${after}"`)
  })

  test('re-renders mounted elements when the document time-zone changes', async () => {
    const date = new Date('2020-01-01T12:00:00.000Z')
    const expectedFor = timeZone =>
      new Intl.DateTimeFormat('en', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone,
        hourCycle: 'h12',
      }).format(date)
    const el = document.createElement('relative-time')
    el.setAttribute('datetime', date.toISOString())
    el.setAttribute('format', 'datetime')
    el.setAttribute('hour', 'numeric')
    el.setAttribute('minute', '2-digit')
    document.documentElement.setAttribute('time-zone', 'Asia/Tokyo')
    fixture.appendChild(el)
    await Promise.resolve()
    const before = el.shadowRoot.textContent
    assert.equal(before, expectedFor('Asia/Tokyo'))
    document.documentElement.setAttribute('time-zone', 'America/New_York')
    await nextTask()
    const after = el.shadowRoot.textContent
    assert.equal(after, expectedFor('America/New_York'))
    assert.notEqual(before, after)
    console.log(`[timezone-switch] "${before}" -> "${after}"`)
  })

  test('missing datetime falls back to light-DOM text, never "Invalid Date"', async () => {
    const el = document.createElement('relative-time')
    el.textContent = 'a while back'
    fixture.appendChild(el)
    await Promise.resolve()
    const text = el.shadowRoot.textContent
    assert.equal(text, 'a while back')
    assert.notMatch(text, /Invalid Date/)
    assert.equal(el.getAttribute('title'), null)
    console.log(`[bad-input:missing] text="${text}" title=${el.getAttribute('title')}`)
  })

  test('unparseable datetime falls back and keeps the raw value on title', async () => {
    const el = document.createElement('relative-time')
    el.textContent = 'A date string'
    el.setAttribute('datetime', 'Invalid')
    fixture.appendChild(el)
    await Promise.resolve()
    const text = el.shadowRoot.textContent
    assert.equal(text, 'A date string')
    assert.notMatch(text, /Invalid Date/)
    assert.equal(el.getAttribute('title'), 'Invalid')
    console.log(`[bad-input:invalid] text="${text}" title="${el.getAttribute('title')}"`)
  })

  test('date-only datetime renders readable text, never "Invalid Date"', async () => {
    const el = document.createElement('relative-time')
    el.setAttribute('datetime', '2022-11-15')
    fixture.appendChild(el)
    await Promise.resolve()
    const text = el.shadowRoot.textContent
    assert.match(text, /Nov 15, 2022/)
    assert.notMatch(text, /Invalid Date/)
    console.log(`[bad-input:date-only] text="${text}" title="${el.getAttribute('title')}"`)
  })

  test('recovers through the same update path when datetime is fixed', async () => {
    const el = document.createElement('relative-time')
    el.setAttribute('datetime', 'Invalid')
    fixture.appendChild(el)
    await Promise.resolve()
    const before = el.shadowRoot.textContent
    assert.notMatch(before, /Invalid Date/)
    el.setAttribute('datetime', daysAgo(1))
    await Promise.resolve()
    const after = el.shadowRoot.textContent
    assert.equal(after, 'yesterday')
    assert.notEqual(el.getAttribute('title'), 'Invalid')
    console.log(`[bad-input:recovered] "${before}" -> "${after}" title="${el.getAttribute('title')}"`)
  })

  test('attribute changes re-render through the same update path', async () => {
    const el = document.createElement('relative-time')
    el.setAttribute('datetime', daysAgo(3))
    fixture.appendChild(el)
    await Promise.resolve()
    const initial = el.shadowRoot.textContent
    assert.equal(initial, '3 days ago')
    el.setAttribute('datetime', daysAgo(1))
    await Promise.resolve()
    const afterDatetime = el.shadowRoot.textContent
    assert.equal(afterDatetime, 'yesterday')
    el.setAttribute('lang', 'es')
    await Promise.resolve()
    const afterLang = el.shadowRoot.textContent
    assert.equal(afterLang, 'ayer')
    el.setAttribute('format', 'datetime')
    el.setAttribute('hour', 'numeric')
    el.setAttribute('minute', '2-digit')
    el.setAttribute('time-zone', 'Asia/Tokyo')
    await Promise.resolve()
    const afterTz = el.shadowRoot.textContent
    assert.notEqual(afterTz, afterLang)
    assert.match(afterTz, /\d/)
    console.log(
      `[attribute-hot-update] datetime:"${initial}" -> "${afterDatetime}" | lang:"${afterDatetime}" -> "${afterLang}" | format+tz:"${afterLang}" -> "${afterTz}"`,
    )
  })
})
