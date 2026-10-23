# CLAUDE.md — The Human Knowledge Engine (HKE)

## Product
HKE — "Speak Once. Build Forever."
Users speak/answer an interview; HKE captures, structures, and stores their knowledge, then generates useful output.
Current priority: Knowledge Vault v1 — simple, shippable, paid.

## Stack
Next.js 14, Supabase, Vercel, Stripe, OpenAI. Package manager: pnpm.

## Brand
From the approved "Crown" dashboard design. Every color and font role lives in lib/brand.ts — no raw colors in pages.
Warm black #0B0A09 (cards #16130F, borders #6B5A36), warm white text #F3EEE6,
gold #E2B84A (buttons, fills) and #E8C766 (headings, links), hot pink #FF4FA3 (current step, script accents).
No turquoise (the legacy turquoise tokens hold champagne gold).
Fonts: Inter for body, Cinzel for titles, Yellowtail script for a few accent words.

## How we work (mandatory)
1. Before any code: show a short plan — files to change, why, and risks. Wait for approval.
2. One small, tightly scoped task at a time.
3. Never invent file contents, variable names, or API shapes — read the actual file first.
4. Run `pnpm build` before calling anything done.
5. No dependency upgrades. No deploys unless explicitly asked.

## DO NOT TOUCH without explicit approval
- Auth / Google OAuth
- Supabase schema, RLS, and entitlement functions
- Stripe checkout, webhooks, pricing
- The 15-question interview
- generate-assets endpoint

## Definition of done
Builds cleanly, works in the browser, and changes only the approved files.

## Visual style
Luxury "empire-builder" look: deep black backgrounds, metallic gold headings,
neon hot-pink script accents, glowing highlights. Motifs: gold crown, butterflies,
sunset city skyline. Feels premium, feminine, powerful. Name shown everywhere:
"The Human Knowledge Engine" (HKE). Never "Human Leverage AI".

## Product principles (every feature must follow these)
- Gentle and judgment-free. Users may not be confident with spelling, grammar, typing, or technology. Never make them feel corrected or "not smart."
- Silently clean up user input (spelling, punctuation, grammar) in everything HKE generates. Never point out their mistakes.
- Plain language by default: short sentences, everyday words, about a 6th-grade reading level.
- Show examples wherever a user has to answer or decide something, so they never face a blank box.
- The heavy lifting happens behind the scenes. The user should only see simple next steps.
- Adapt to the person: start simple, and offer more depth as they show they're ready.
