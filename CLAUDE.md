# CLAUDE.md — The Human Knowledge Engine (HKE)

## Product
HKE — "Speak Once. Build Forever."
Users speak/answer an interview; HKE captures, structures, and stores their knowledge, then generates useful output.
Current priority: Knowledge Vault v1 — simple, shippable, paid.

## Stack
Next.js 14, Supabase, Vercel, Stripe, OpenAI. Package manager: pnpm.

## Brand
Black #070707, white, hot pink #FF1493, gold #D4AF37, turquoise #20D9D2 (sparing accent).
Inter font. Glassmorphism style.

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
