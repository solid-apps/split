// split — embed N apps/URLs side by side in resizable iframes.
//
// Starts with two panes but the model is an array, so "+ Pane", remove, the
// draggable dividers and the saved layout all work for any N. Best for framing
// your own pod apps (same-origin — they embed fine); many external sites block
// framing via X-Frame-Options/CSP.
//
// Layout (which app/URL per pane + sizes) is saved privately to your pod.

const panesEl = document.getElementById('panes')
const appListEl = document.getElementById('appList')
const APPS = new URL('../', location.href)                              // <pod>/public/apps/
const LAYOUT_URL = new URL('../../../private/split/layout.jsonld', location.href)

const authFetch = (url, opts) => ((window.xlogin && window.xlogin.authFetch) || fetch)(url, opts)
const loggedIn = () => !!(window.xlogin && window.xlogin.id)
const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;')

let LAYOUT = { panes: [{ src: '', grow: 1 }, { src: '', grow: 1 }] }
let APP_NAMES = []

// --- installed apps (for the picker datalist) ---
function ldpContains(doc) {
  const c = doc['ldp:contains'] || doc['http://www.w3.org/ns/ldp#contains'] || doc.contains || []
  return (Array.isArray(c) ? c : [c]).map((x) => (typeof x === 'string' ? x : x['@id'] || x.id)).filter(Boolean)
}
async function loadApps() {
  try {
    const r = await fetch(APPS, { headers: { Accept: 'application/ld+json' } })
    if (!r.ok) return []
    return ldpContains(await r.json()).filter((u) => u.endsWith('/'))
      .map((u) => decodeURIComponent(u.replace(/\/$/, '').split('/').pop()))
      .filter((n) => n && !n.startsWith('.') && n !== 'split').sort()
  } catch { return [] }
}

// --- layout persistence ---
async function loadLayout() {
  try {
    const r = await authFetch(LAYOUT_URL, { headers: { Accept: 'application/ld+json' } })
    if (r.ok) { const d = await r.json(); if (Array.isArray(d.panes) && d.panes.length) LAYOUT = { panes: d.panes } }
  } catch { /* default */ }
}
const LS_KEY = 'split.layout.v1'
function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    if (d && Array.isArray(d.panes) && d.panes.length) LAYOUT = { panes: d.panes }
  } catch { /* none / private mode */ }
}
async function saveLayout() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(LAYOUT)) } catch { /* private mode */ }
  if (!loggedIn()) return  // pod sync below is signed-in only; localStorage already kept it
  const put = () => authFetch(LAYOUT_URL, { method: 'PUT', headers: { 'Content-Type': 'application/ld+json' }, body: JSON.stringify(LAYOUT) })
  let r = await put()
  if (!r.ok && (r.status === 404 || r.status === 409)) {
    await authFetch(new URL('../../../private/split/', location.href), { method: 'PUT', headers: { 'Content-Type': 'text/turtle' }, body: '' }).catch(() => {})
    await put()
  }
}

// An app name → its pod path; a URL stays as-is; blank = empty pane.
function resolveSrc(s) {
  s = (s || '').trim()
  if (!s) return ''
  if (/^https?:\/\//.test(s) || s.startsWith('/') || s.startsWith('../')) return s
  return `../${s}/`            // bare name → installed app
}

function render() {
  panesEl.innerHTML = ''
  LAYOUT.panes.forEach((pane, i) => {
    const el = document.createElement('div')
    el.className = 'pane'
    el.style.flex = `${pane.grow || 1} 1 0`
    const src = resolveSrc(pane.src)
    el.innerHTML = `
      <div class="pane-head">
        <input class="pane-src" list="appList" placeholder="app name or URL" value="${esc(pane.src)}">
        <button class="pane-x" title="Remove pane" ${LAYOUT.panes.length <= 1 ? 'disabled' : ''}>×</button>
      </div>
      ${src
        ? `<iframe class="pane-frame" src="${esc(src)}" referrerpolicy="no-referrer"></iframe>`
        : '<div class="pane-empty">Pick an app or paste a URL above.<br><small>Your pod apps embed cleanly; some external sites block framing.</small></div>'}`
    const input = el.querySelector('.pane-src')
    const commit = () => { LAYOUT.panes[i].src = input.value.trim(); saveLayout(); render() }
    input.addEventListener('change', commit)
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit() })
    el.querySelector('.pane-x').addEventListener('click', () => { LAYOUT.panes.splice(i, 1); saveLayout(); render() })
    panesEl.appendChild(el)

    if (i < LAYOUT.panes.length - 1) {
      const d = document.createElement('div')
      d.className = 'divider'
      wireResize(d, i)
      panesEl.appendChild(d)
    }
  })
}

// Drag a divider to resize the two adjacent panes (flex-grow ratio).
function wireResize(divider, i) {
  divider.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    const panes = [...panesEl.querySelectorAll('.pane')]
    const a = panes[i], b = panes[i + 1]
    if (!a || !b) return
    const horiz = getComputedStyle(panesEl).flexDirection === 'row'
    const startPos = horiz ? e.clientX : e.clientY
    const aSize = horiz ? a.offsetWidth : a.offsetHeight
    const bSize = horiz ? b.offsetWidth : b.offsetHeight
    divider.setPointerCapture(e.pointerId)
    const move = (ev) => {
      const delta = (horiz ? ev.clientX : ev.clientY) - startPos
      const ag = Math.max(40, aSize + delta), bg = Math.max(40, bSize - delta)
      a.style.flex = `${ag} 1 0`; b.style.flex = `${bg} 1 0`
      LAYOUT.panes[i].grow = ag; LAYOUT.panes[i + 1].grow = bg
    }
    const up = () => { divider.removeEventListener('pointermove', move); divider.removeEventListener('pointerup', up); saveLayout() }
    divider.addEventListener('pointermove', move)
    divider.addEventListener('pointerup', up)
  })
}

document.getElementById('addPane').addEventListener('click', () => {
  LAYOUT.panes.push({ src: '', grow: 1 }); saveLayout(); render()
})

async function init() {
  APP_NAMES = await loadApps()
  appListEl.innerHTML = APP_NAMES.map((n) => `<option value="${esc(n)}">`).join('')
  loadLocal()
  if (loggedIn()) await loadLayout()  // pod copy (synced across devices) overrides the local cache
  render()
}
init()
document.addEventListener('xlogin', init)
