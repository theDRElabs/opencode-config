# React Performance Quick Reference

Condensed from `vercel-react-best-practices/rules/` — 22 highest-impact rules.
See full rule files for extended explanations and edge cases.

---

## async — Eliminating Waterfalls (CRITICAL)

### Promise.all() for Independent Operations
Sequential awaits = N round trips. Parallel = 1.
```ts
// Bad
const user = await fetchUser()
const posts = await fetchPosts()
// Good
const [user, posts] = await Promise.all([fetchUser(), fetchPosts()])
```

### Dependency-Based Parallelization
Partial dependencies: use `better-all` or manual promise chaining.
```ts
// Bad — profile waits for user
const [user, config] = await Promise.all([fetchUser(), fetchConfig()])
const profile = await fetchProfile(user.id)
// Good — profile starts as soon as user resolves
const userPromise = fetchUser()
const profilePromise = userPromise.then(u => fetchProfile(u.id))
const [user, config, profile] = await Promise.all([userPromise, fetchConfig(), profilePromise])
```

### Prevent Waterfalls in API Routes
Start promises immediately, await later.
```ts
// Bad
const session = await auth()
const config = await fetchConfig()
// Good
const sessionPromise = auth()
const configPromise = fetchConfig()
const session = await sessionPromise
const [config, data] = await Promise.all([configPromise, fetchData(session.user.id)])
```

### Defer Await Until Needed
Move `await` into the branch that uses it.
```ts
// Bad — blocks even when skipProcessing=true
const userData = await fetchUserData(userId)
if (skipProcessing) return { skipped: true }
// Good
if (skipProcessing) return { skipped: true }
const userData = await fetchUserData(userId)
```

### Strategic Suspense Boundaries
Don't await data before JSX — wrap in Suspense so shell renders immediately.
```tsx
// Bad — entire page blocked
async function Page() {
  const data = await fetchData()
  return <div><Header/><DataDisplay data={data}/><Footer/></div>
}
// Good — header/footer stream in, only DataDisplay waits
function Page() {
  return <div><Header/><Suspense fallback={<Skeleton/>}><DataDisplay/></Suspense><Footer/></div>
}
```

---

## bundle — Size Optimization (CRITICAL)

### Avoid Barrel File Imports
Barrel `index.js` re-exports load 1K-10K modules. Import directly or use `optimizePackageImports`.
```ts
// Bad — loads 1,583 modules
import { Check, X, Menu } from 'lucide-react'
// Good — next.config.js
module.exports = { experimental: { optimizePackageImports: ['lucide-react'] } }
// Non-Next.js: direct import
import Check from 'lucide-react/dist/esm/icons/check'
```

### Dynamic Imports for Heavy Components
Lazy-load large components not needed on initial render.
```tsx
// Bad — Monaco (~300KB) in main chunk
import { MonacoEditor } from './monaco-editor'
// Good — loads on demand
const MonacoEditor = dynamic(() => import('./monaco-editor').then(m => m.MonacoEditor), { ssr: false })
```

### Prefer Statically Analyzable Paths
Dynamic paths widen bundler's file set. Use explicit maps.
```ts
// Bad — bundler can't trace
const mod = await import(PAGE_MODULES[pageName])
// Good — explicit map
const PAGE_MODULES = { home: () => import('./pages/home') }
const Page = await PAGE_MODULES[pageName]()
```

---

## server — Server-Side Performance (CRITICAL/HIGH)

### Parallel Data Fetching with Component Composition
RSCs execute sequentially — split into sibling components to parallelize.
```tsx
// Bad — Sidebar waits for Page's fetch
export default async function Page() {
  const header = await fetchHeader()
  return <div>{header}<Sidebar /></div>
}
// Good — both fetch simultaneously
function Header() { return <div>{await fetchHeader()}</div> }
function Sidebar() { return <nav>{await fetchSidebarItems()}</nav> }
export default function Page() { return <div><Header /><Sidebar /></div> }
```

### Parallel Nested Data Fetching
Chain nested fetches per item, not globally.
```ts
// Bad — one slow chat blocks all author fetches
const chats = await Promise.all(ids.map(id => getChat(id)))
const authors = await Promise.all(chats.map(c => getUser(c.author)))
// Good — each item chains independently
const authors = await Promise.all(ids.map(id => getChat(id).then(c => getUser(c.author))))
```

### Authenticate Server Actions
Server Actions are public endpoints. Always auth inside the action.
```ts
// Bad — anyone can call deleteUser
export async function deleteUser(userId: string) {
  await db.user.delete({ where: { id: userId } })
}
// Good
export async function deleteUser(userId: string) {
  const session = await verifySession()
  if (!session) throw unauthorized('Must be logged in')
  await db.user.delete({ where: { id: userId } })
}
```

### Minimize Serialization at RSC Boundaries
Only pass fields the client uses — the whole object gets serialized.
```tsx
// Bad — 50 fields serialized, 1 used
return <Profile user={user} />
// Good — only what's needed
return <Profile name={user.name} />
```

### Hoist Static I/O to Module Level
Fonts, logos, configs: load once at module scope, not per request.
```ts
// Bad — reads font on every request
export async function GET() {
  const font = await fetch(new URL('./fonts/Inter.ttf', import.meta.url)).then(r => r.arrayBuffer())
}
// Good — module-level promise
const fontData = fetch(new URL('./fonts/Inter.ttf', import.meta.url)).then(r => r.arrayBuffer())
export async function GET() {
  const font = await fontData
}
```

### Avoid Shared Module State for Request Data
Module-level mutable variables leak across concurrent RSC renders.
```tsx
// Bad — race condition between concurrent renders
let currentUser: User | null = null
export default async function Page() {
  currentUser = await auth()
}
// Good — pass via props
export default async function Page() {
  const user = await auth()
  return <Dashboard user={user} />
}
```

---

## rerender — Re-render Optimization (HIGH/MEDIUM)

### Don't Define Components Inside Components
Creates new component type each render → full remount, state loss.
```tsx
// Bad
function UserProfile({ user }) {
  const Avatar = () => <img src={user.avatarUrl} /> // remounts every render
}
// Good — pass props
function Avatar({ src }: { src: string }) { return <img src={src} /> }
function UserProfile({ user }) { return <Avatar src={user.avatarUrl} /> }
```

### Calculate Derived State During Rendering
Don't store computed values in state or effects — derive inline.
```tsx
// Bad — extra render + state drift
const [fullName, setFullName] = useState('')
useEffect(() => { setFullName(first + ' ' + last) }, [first, last])
// Good
const fullName = first + ' ' + last
```

### Functional setState Updates
Use `setState(curr => ...)` for stable callbacks and no stale closures.
```tsx
// Bad — stale closure or dependency on items
const add = useCallback((newItems) => setItems([...items, ...newItems]), [items])
// Good — stable, always fresh
const add = useCallback((newItems) => setItems(curr => [...curr, ...newItems]), [])
```

### Use useRef for Transient Values
Frequent updates that don't need re-render → ref, not state.
```tsx
// Bad — re-renders on every mousemove
const [lastX, setLastX] = useState(0)
// Good — updates DOM directly
const lastXRef = useRef(0)
// In handler: lastXRef.current = e.clientX; node.style.transform = ...
```

---

## rendering — Rendering Performance (HIGH/MEDIUM)

### Use defer/async on Script Tags
Bare `<script>` blocks HTML parsing and delays FCP/TTI.
```tsx
// Bad
<script src="/analytics.js" />
// Good
<script src="/analytics.js" async />
<script src="/utils.js" defer />
// Next.js: <Script src="..." strategy="afterInteractive" />
```

### CSS content-visibility for Long Lists
Skip off-screen rendering for massive lists.
```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

---

## js — JavaScript Micro-optimizations (MEDIUM/LOW)

### Use Set/Map for O(1) Lookups
Repeated `.includes()` on arrays → convert to Set first.
```ts
// Bad — O(n) per check
items.filter(item => allowedIds.includes(item.id))
// Good — O(1) per check
const allowed = new Set(allowedIds)
items.filter(item => allowed.has(item.id))
```

### Early Length Check for Array Comparisons
O(1) length check before expensive sort/compare.
```ts
// Bad — sorts even when lengths differ
return current.sort().join() !== original.sort().join()
// Good
if (current.length !== original.length) return true
// then compare element-by-element
```
