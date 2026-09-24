---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Covers aesthetic direction, typography, anti-patterns, premium component architecture, motion choreography, and performance guardrails. Makes choices that don't read as templated defaults.
license: Complete terms in LICENSE.txt
---

# Frontend Design

Approach this as the design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's. This client has already rejected proposals that felt templated, and is paying for a distinctive point of view: make deliberate, opinionated choices about palette, typography, and layout that are specific to this brief, and take one real aesthetic risk you can justify.

## Ground it in the subject

If the brief does not pin down what the product or subject is, pin it yourself before designing: name one concrete subject, its audience, and the page's single job, and state your choice. If there's any information in your memory about the human's preferences, context about what they're building, or designs you've made before – use that as a hint. The subject's own world, its materials, instruments, artifacts, and vernacular, is where distinctive choices come from. Build with the brief's real content and subject matter throughout.

## Design principles

For web designs, the hero is a thesis. Open with the most characteristic thing in the subject's world, in whatever form makes sense for it: a headline, an image, an animation, a live demo, an interactive moment. Be deliberate with your choice: a big number with a small label, supporting stats, and a gradient accent is the template answer, only use if that's truly the best option.

Typography carries the personality of the page. Pair the display and body faces deliberately, not the same families you would reach for on any other project, and set a clear type scale with intentional weights, widths, and spacing. Make the type treatment itself a memorable part of the design, not a neutral delivery vehicle for the content.

Structure is information. Structural devices, numbering, eyebrows, dividers, labels, should encode something true about the content, not decorate it. Many generic designs use numbered markers (01 / 02 / 03), but that's only appropriate if the content actually is a sequence - like a real process or a typed timeline where order carries information the reader needs. Question if choices like numbered markers actually make sense before incorporating them.

Leverage motion deliberately. Think about where and if animation can serve the subject: a page-load sequence, a scroll-triggered reveal, hover micro-interactions, ambient atmosphere. An orchestrated moment usually lands harder than scattered effects; choose what the direction calls for. However, sometimes less is more, and extra animation contributes to the feeling that the design is AI-generated.

Match complexity to the vision. Maximalist directions need elaborate execution; minimal directions need precision in spacing, type, and detail. Elegance is executing the chosen vision well.

Consider written content carefully. Often a design brief may not contain real content, and it's up to you to come up with copy. Copy can make a design feel as templated as the design itself. See the below section on writing for more guidance.

## Process: brainstorm, explore, plan, critique, build, critique again

For calibration: AI-generated design right now clusters around three looks: (1) a warm cream background (near #F4F1EA) with a high-contrast serif display and a terracotta accent; (2) a near-black background with a single bright acid-green or vermilion accent; (3) a broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns. All three are legitimate for some briefs, but they are defaults rather than choices, and they appear regardless of subject. Where the brief pins down a visual direction, follow it exactly — the brief's own words always win, including when it asks for one of these looks. Where it leaves an axis free, don't spend that freedom on one of these defaults. Just like a human designer who's hired, there's often a careful balance between doing what you're good at and taking each project as a chance to experiment and learn.

Work in two passes. First, brainstorm a short design plan based on the human's design brief: create a compact token system with color, type, layout, and signature. Color: describe the palette as 4–6 named hex values. Type: the typefaces for 2+ roles (a characterful display face that's used with restraint, a complementary body face, and a utility face for captions or data if needed). Layout: a layout concept, using one-sentence prose descriptions and ASCII wireframes to ideate and compare. Signature: the single unique element this page will be remembered by that embodies the brief in an appropriate way.

Then review that plan against the brief before building: if any part of it reads like the generic default you would produce for any similar page (work through a similar prompt to see if you arrive somewhere similar) rather than a choice made for this specific brief — revise that part, say what you changed and why. Only after you've confirmed the relative uniqueness of your design plan should you start to write the code, following the revised plan exactly and deriving every color and type decision from it.

When writing the code, be careful of structuring your CSS selector specificities. It's easy to generate CSS classes that cancel each other out (especially with a type-based selector like .section and a element-based selector like .cta). This can happen often with paddings/margins between sections.

Try to do a lot of this planning and iteration in your thinking, and only show ideas to the user when you have higher confidence it'll delight them.

## Restraint and self-critique

Spend your boldness in one place. Let the signature element be the one memorable thing, keep everything around it quiet and disciplined, and cut any decoration that does not serve the brief. Not taking a risk can be a risk itself! Build to a quality floor without announcing it: responsive down to mobile, visible keyboard focus, reduced motion respected. Critique your own work as you build, taking screenshots if your environment supports it – a picture is worth 1000 tokens. Consider Chanel's advice: before leaving the house, take a look in the mirror and remove one accessory. Human creators have memory and always try to do something new, so if you have a space to quickly jot down notes about what you've tried, it can help you in future passes.

## More on writing in design

Words appear in a design for one reason: to make it easier to understand, and therefore easier to use. They are design material, not decoration. Bring the same intentionality to copy that you would bring to spacing and color. Before writing anything, ask what the design needs to say, and how it can best be said to help the person navigate the experience.

Write from the end user's side of the screen. Name things by what people control and recognize, never by how the system is built. A person manages notifications, not webhook config. Describe what something does in plain terms rather than selling it. Being specific is always better than being clever.

Use active voice as default. A control should say exactly what happens when it's used: "Save changes," not "Submit." An action keeps the same name through the whole flow, so the button that says "Publish" produces a toast that says "Published." The vocabulary of an interface is the signposting for someone navigating the product. Cohesion and consistency are how people learn their way around.

Treat failure and emptiness as moments for direction, not mood. Explain what went wrong and how to fix it, in the interface's voice rather than a person's. Errors don't apologize, and they are never vague about what happened. An empty screen is an invitation to act.

Keep the register conversational and tuned: plain verbs, sentence case, no filler, with tone matched to the brand and the audience. Let each element do exactly one job. A label labels, an example demonstrates, and nothing quietly does double duty.

## Anti-patterns (Absolute Zero)

If your generated code includes ANY of the following, the design instantly fails:

- **Banned Fonts:** Inter, Roboto, Arial, Open Sans, Helvetica. Use premium fonts like Geist, Clash Display, PP Editorial New, or Plus Jakarta Sans.
- **Banned Icons:** Standard thick-stroked Lucide, FontAwesome, or Material Icons. Use only ultra-light, precise lines (e.g., Phosphor Light, Remix Line).
- **Banned Borders & Shadows:** Generic 1px solid gray borders. Harsh, dark drop shadows (`shadow-md`, `rgba(0,0,0,0.3)`).
- **Banned Layouts:** Edge-to-edge sticky navbars glued to the top. Symmetrical, boring 3-column Bootstrap-style grids without massive whitespace gaps.
- **Banned Motion:** Standard `linear` or `ease-in-out` transitions. Instant state changes without interpolation.

## Creative Variance Engine

Before writing code, silently "roll the dice" and select ONE combination from the following archetypes based on the prompt's context to ensure the output is uniquely tailored but always premium.

### Vibe & Texture Archetypes (Pick 1)

1. **Ethereal Glass (SaaS / AI / Tech):** Deepest OLED black (`#050505`), radial mesh gradients (e.g., subtle glowing purple/emerald orbs) in the background. Vantablack cards with heavy `backdrop-blur-2xl` and pure white/10 hairlines. Wide geometric Grotesk typography.
2. **Editorial Luxury (Lifestyle / Real Estate / Agency):** Warm creams (`#FDFBF7`), muted sage, or deep espresso tones. High-contrast Variable Serif fonts for massive headings. Subtle CSS noise/film-grain overlay (`opacity-[0.03]`) for a physical paper feel.
3. **Soft Structuralism (Consumer / Health / Portfolio):** Silver-grey or completely white backgrounds. Massive bold Grotesk typography. Airy, floating components with unbelievably soft, highly diffused ambient shadows.

### Layout Archetypes (Pick 1)

1. **The Asymmetrical Bento:** A masonry-like CSS Grid of varying card sizes (e.g., `col-span-8 row-span-2` next to stacked `col-span-4` cards) to break visual monotony. Mobile: falls back to single-column stack (`grid-cols-1`) with generous vertical gaps (`gap-6`).
2. **The Z-Axis Cascade:** Elements stacked like physical cards, slightly overlapping with varying depths of field, some with subtle `-2deg` or `3deg` rotation. Mobile: remove all rotations and overlaps below `768px`. Stack vertically with standard spacing.
3. **The Editorial Split:** Massive typography on the left half (`w-1/2`), with interactive, scrollable horizontal image pills or staggered cards on the right. Mobile: converts to full-width vertical stack (`w-full`).

**Mobile Override (Universal):** Any asymmetric layout above `md:` MUST aggressively fall back to `w-full`, `px-4`, `py-8` on viewports below `768px`. Never use `h-screen` — always use `min-h-[100dvh]` to prevent iOS Safari viewport jumping.

## Haptic Micro-Aesthetics

### Double-Bezel (Nested Architecture)

Never place a premium card flatly on the background. Use nested enclosures:

- **Outer Shell:** A wrapper `div` with subtle background (`bg-black/5` or `bg-white/5`), hairline outer border (`ring-1 ring-black/5`), specific padding (`p-1.5` or `p-2`), large outer radius (`rounded-[2rem]`).
- **Inner Core:** The actual content container with its own background, inner highlight (`shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]`), and mathematically smaller radius (`rounded-[calc(2rem-0.375rem)]`).

### Nested CTA & Island Button Architecture

- Primary interactive buttons must be fully rounded pills (`rounded-full`) with generous padding (`px-6 py-3`).
- If a button has an arrow (`↗`), it NEVER sits naked next to the text. It must be nested inside its own circular wrapper (e.g., `w-8 h-8 rounded-full bg-black/5 flex items-center justify-center`) flush with the main button's right inner padding.

### Spatial Rhythm & Tension

- **Macro-Whitespace:** Double your standard padding. Use `py-24` to `py-40` for sections. Allow the design to breathe heavily.
- **Eyebrow Tags:** Precede major H1/H2s with a microscopic, pill-shaped badge (`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium`).

## Motion Choreography

Never use default transitions. All motion must simulate real-world mass and spring physics. Use custom cubic-beziers (e.g., `transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`).

### Fluid Island Nav & Hamburger Reveal

- **Closed State:** Navbar is a floating glass pill detached from the top (`mt-6`, `mx-auto`, `w-max`, `rounded-full`).
- **Hamburger Morph:** On click, lines fluidly rotate and translate to form a perfect 'X' (`rotate-45` and `-rotate-45` with absolute positioning).
- **Modal Expansion:** Menu opens as a massive, screen-filling overlay with heavy glass effect (`backdrop-blur-3xl bg-black/80`).
- **Staggered Mask Reveal:** Nav links fade in and slide up from invisible (`translate-y-12 opacity-0` to `translate-y-0 opacity-100`) with staggered delay (`delay-100`, `delay-150`, `delay-200`).

### Magnetic Button Hover Physics

- Use the `group` utility. On hover, scale the button down slightly (`active:scale-[0.98]`) to simulate physical pressing.
- The nested inner icon circle translates diagonally (`group-hover:translate-x-1 group-hover:-translate-y-[1px]`) and scales up slightly (`scale-105`).

### Scroll Interpolation (Entry Animations)

- Elements execute a gentle, heavy fade-up (`translate-y-16 blur-md opacity-0` resolving to `translate-y-0 blur-0 opacity-100` over 800ms+).
- For JS-driven scroll reveals, use `IntersectionObserver` or Framer Motion's `whileInView`. Never use `window.addEventListener('scroll')`.

## Performance Guardrails

- **GPU-Safe Animation:** Never animate `top`, `left`, `width`, or `height`. Animate exclusively via `transform` and `opacity`. Use `will-change: transform` sparingly.
- **Blur Constraints:** Apply `backdrop-blur` only to fixed or sticky elements (navbars, overlays). Never apply to scrolling containers or large content areas.
- **Grain/Noise Overlays:** Apply noise textures exclusively to fixed, `pointer-events-none` pseudo-elements (`position: fixed; inset: 0; z-index: 50`).
- **Z-Index Discipline:** Do not use arbitrary `z-50` or `z-[9999]`. Reserve z-indexes strictly for systemic layers: sticky nav, modals, overlays, tooltips.

## Pre-Output Checklist

- [ ] No banned fonts, icons, borders, shadows, layouts, or motion patterns present
- [ ] A Vibe Archetype and Layout Archetype were consciously selected and applied
- [ ] All major cards use the Double-Bezel nested architecture (outer shell + inner core)
- [ ] CTA buttons use the Button-in-Button trailing icon pattern where applicable
- [ ] Section padding is at minimum `py-24`
- [ ] All transitions use custom cubic-bezier curves — no `linear` or `ease-in-out`
- [ ] Scroll entry animations are present — no element appears statically
- [ ] Layout collapses gracefully below `768px` to single-column with `w-full` and `px-4`
- [ ] All animations use only `transform` and `opacity`
- [ ] `backdrop-blur` is only applied to fixed/sticky elements
