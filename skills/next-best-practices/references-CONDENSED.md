# Next.js Best Practices — Condensed Reference

## Async Patterns
- In Next.js 15+, `params`, `searchParams`, `cookies()`, `headers()` are all `Promise<...>` — must `await` them
- In non-async components, use `React.use()` instead of `await`
- Run codemod: `npx @next/codemod@latest next-async-request-api .`

## Bundling
- Browser-only packages (`window`/`document`): use `dynamic(() => import('x'), { ssr: false })`
- Native bindings or bad ESM bundles: `serverExternalPackages` or `transpilePackages` in next.config
- Never use `<link>` for CSS — use `import './styles.css'`; skip redundant polyfill.io CDN

## Data Patterns
- Server Components fetch directly (no API layer needed); prefer for all reads
- Server Actions (`'use server'`) for all mutations from UI — POST only, no external access
- Avoid waterfalls: `Promise.all` for parallel fetches, or wrap in separate `<Suspense>` boundaries
- Route Handlers only for: external webhooks, public REST APIs, cacheable GET endpoints

## Debug Tricks
- Dev MCP endpoint at `/_next/mcp` (JSON-RPC): `get_errors`, `get_routes`, `get_logs`, `get_project_metadata`
- `next build --debug-build-paths "/route"` rebuilds only that route (Next.js 16+)
- `next experimental-analyze` for interactive bundle size inspection

## Directives
- `'use client'` — required for hooks, event handlers, browser APIs
- `'use server'` — marks function as Server Action (can be inline or top-level)
- `'use cache'` — Next.js Cache Components (requires `cacheComponents: true` in config)

## Error Handling
- `error.tsx` must be `'use client'`; `global-error.tsx` must include `<html>` and `<body>`
- **Never wrap `redirect()`/`notFound()`/`forbidden()`/`unauthorized()` in try-catch** — call them outside or re-throw
- Errors bubble to nearest `error.tsx`; layout errors go to `global-error.tsx`

## File Conventions
- Required: `layout.tsx` (root), `page.tsx` (each route). Special: `loading.tsx`, `error.tsx`, `not-found.tsx`, `template.tsx`
- `route.ts` and `page.tsx` **cannot coexist** in the same folder
- Next.js 14-15: `middleware.ts` / Next.js 16+: `proxy.ts` (renamed export)
- Private folders: prefix with `_` to exclude from routing

## Font
- Always use `next/font` — never `<link>` tags, never `@import` in CSS
- Define fonts once in root layout via CSS variables; reuse via `var(--font-x)`
- Always specify `subsets` (e.g. `['latin']`) to avoid loading all characters

## Functions
- `useRouter`, `usePathname`, `useSearchParams`, `useParams` are Client-only hooks
- `generateStaticParams` for build-time pre-rendering of dynamic routes
- `after()` runs code after response finishes streaming (analytics, logging)

## Hydration Errors
- Wrap browser-only values (`window.innerWidth`, `Date`, random IDs) in client-only rendering with mounted check
- Use `useId()` instead of `Math.random()` for IDs; validate HTML nesting (`div` inside `p` is invalid)
- Third-party DOM-modifying scripts: use `next/script` with `strategy="afterInteractive"`

## Image
- Always use `next/image` with explicit `width`/`height` or `fill` + `sizes`
- Remote domains require `images.remotePatterns` in next.config
- `priority` for above-the-fold images (LCP); below-fold images are lazy-loaded by default
- Static export (`output: 'export'`): use `unoptimized` or custom loader

## Metadata
- `metadata` and `generateMetadata` are **Server Components only** — move client logic to children
- Use `React.cache()` to avoid duplicate fetches between page data and metadata generation
- Use `next/og` (not `@vercel/og`) for OG images; static `opengraph-image.png` covers both OG and Twitter
- Title templates in root layout: `{ default: 'Site Name', template: '%s | Site Name' }`

## Parallel Routes
- Every `@slot` MUST have a `default.tsx` (returns `null`) or refreshes 404
- Close modals with `router.back()` — never `router.push()` or `<Link>` (causes history stack issues)
- Intercepting prefixes: `(.)` same level, `(..)` one up, `(...)` from root — match route segments, not filesystem

## Route Handlers
- Export named functions: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- Server environment: no React hooks, no React DOM APIs, no browser APIs — but Node.js `fs`/`crypto` work
- Prefer Server Actions for UI mutations; use Route Handlers for external integrations only

## RSC Boundaries
- Client components **cannot** be async functions — fetch data in parent server component, pass as props
- Server → Client props must be JSON-serializable: no `Date`, `Map`, `Set`, class instances, functions (except Server Actions)
- Serialize `Date` to `.toISOString()`, `Map`/`Set` to `Array`/`Object` before passing to client

## Runtime Selection
- Default to Node.js runtime (full API support, `fs`, `crypto`, most npm packages)
- Edge runtime only if project already uses it or specific latency/geography requirement exists
- Before adding `runtime = 'edge'`: verify all deps are Edge-compatible

## Scripts
- Always use `next/script` — never native `<script>` tags; inline scripts require `id` attribute
- Don't place `next/script` inside `next/head` — it handles its own positioning
- Google Analytics/GTM: use `@next/third-parties/google` components, not inline scripts

## Self-Hosting
- `output: 'standalone'` for Docker — creates minimal production build
- ISR with multiple instances **requires** a custom cache handler (Redis/S3) — filesystem cache breaks
- Always set `HOSTNAME="0.0.0.0"` in containers; copy `public/` and `.next/static/` separately
- Add a `/api/health` endpoint for load balancers

## Suspense Boundaries
- `useSearchParams()` always requires `<Suspense>` in static routes — without it, entire page becomes CSR
- `usePathname()` requires `<Suspense>` on dynamic routes (not needed with `generateStaticParams`)
- `useParams()` and `useRouter()` do not require Suspense boundaries
