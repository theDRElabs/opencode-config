# Lumen — AI Project Planner: Implementation Plan

## Stack & Decisions
- **Next.js** (latest, App Router, TS), **Tailwind v4**, **shadcn/ui**, **npm**.
- **AI SDK v5** + **`@ai-sdk/openai-compatible`** pointing at OpenRouter (`baseURL: https://openrouter.ai/api/v1`, `OPENROUTER_API_KEY`). Fallback to official `@openrouter/ai-sdk-provider` if structured output is flaky.
- **`streamObject`** (zod schema, one call) → streams partial brief data so each bento cell fills with skeleton shimmer — matches DESIGN.md §6.7.
- **`@xyflow/react`** (React Flow v12) for the data-model visualization. CSS imported in `globals.css` after Tailwind.
- **localStorage** persistence; **no DB, no auth**.

## Routes
| Route | Purpose |
|---|---|
| `/` | Hero (Editorial Split): headline left, Idea Composer right (DESIGN.md §7.2). |
| `/brief` | Asymmetrical Bento workspace of 9 editable sections + React Flow canvas (DESIGN.md §7.3). |
| `POST /api/generate` | Route handler → `streamObject` → streams partial brief object. |
| `POST /api/regenerate-prompt` | Takes edited brief, regenerates only `starterPrompt`. |

## Data model (zod schema — the AI's output contract)
```
summary: string
targetUsers: string[]
coreFeatures: string[]
techStack: string[]
pages: string[]
dataModel: { entities: { name, fields[], relations[] }[] }   // → React Flow nodes/edges
buildPhases: { phase, tasks[] }[]
risks: string[]
starterPrompt: string
```

## Key files
- `lib/schema.ts` — zod brief schema; `lib/types.ts`; `lib/openrouter.ts` (provider); `lib/prompt.ts` (system prompt builder); `lib/flow.ts` (dataModel → nodes/edges); `lib/storage.ts`
- `hooks/useBrief.ts` — stream consumption, editable state, localStorage sync, per-cell loading flags
- `components/BackgroundGlow`, `FluidNav`, `IdeaComposer`, `BriefWorkspace`, `SectionCard` (+ type-specific renderers: features list, phase timeline, risk pills), `DataModelCanvas`, `CodeBlock` (copyable prompt)
- `globals.css` — DESIGN.md tokens: Geist + Plus Jakarta Sans + Geist Mono via `next/font`, palette, double-bezel, motion curves, radial orbs

## Data flow
1. User types idea → `IdeaComposer` POSTs to `/api/generate`.
2. Route streams partial object → `useBrief` updates each cell as its field arrives (skeleton shimmer while empty).
3. On completion → persist to localStorage → `router.push('/brief')`.
4. Edits update state → "Regenerate prompt" button POSTs edited brief → only prompt cell refreshes.

## Build phases
1. Scaffold: `create-next-app`, add Tailwind, shadcn/ui, `ai`, `@ai-sdk/openai-compatible`, `zod`, `@xyflow/react`.
2. Design tokens + global chrome (background orbs, noise, fonts, fluid nav).
3. Hero + IdeaComposer + streaming generate route + persistence.
4. Brief workspace: bento grid, editable SectionCards, CodeBlock.
5. Data Model Canvas (React Flow), prompt regeneration.
6. Polish (entry animations, mobile collapse) → verify: lint, typecheck, `next build`.

## Known risks
- **OpenRouter structured output** varies by model (`supportsStructuredOutputs` caveat) — test chosen model; fallback to `streamText` + JSON parse.
- **`streamObject` partial data** — cells render only when their field is non-empty.
- **React Flow v12 node sizing** — don't set `node.width/height` (fixed dimensions); rely on `fitView`.
- **localStorage SSR hydration** — read on client mount only.
- **Clipboard** on insecure contexts — textarea fallback.
- Model ID must be confirmed at build time (never hardcode from memory).
