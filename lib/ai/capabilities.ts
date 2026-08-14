export type HLAICapability = {
  id: string
  name: string
  category: 'build' | 'market' | 'sell' | 'create' | 'analyze' | 'support' | 'automate'
  description: string
  stage: 'core' | 'planned'
}

/**
 * Human Leverage AI capability registry.
 * These are intentionally modular: the interview creates the shared business
 * context, then individual capabilities can consume that context without
 * forcing the founder to repeat their business information.
 */
export const HLAI_CAPABILITIES: HLAICapability[] = [
  { id: 'app-builder', name: 'App Builder', category: 'build', description: 'Turn a business idea into an application blueprint and implementation plan.', stage: 'core' },
  { id: 'app-builder-background', name: 'App Builder Background', category: 'build', description: 'Handle longer-running build tasks without blocking the main experience.', stage: 'planned' },
  { id: 'competitive-brief', name: 'Competitive Intelligence', category: 'analyze', description: 'Research competitors, positioning, offers, messaging, gaps, and opportunities.', stage: 'planned' },
  { id: 'content-strategy', name: 'Content Strategy', category: 'market', description: 'Create a capacity-aware 30/60/90-day organic content strategy.', stage: 'planned' },
  { id: 'wingman-content-creator', name: 'Content Creator', category: 'create', description: 'Draft channel-ready written marketing content and repurpose existing ideas.', stage: 'planned' },
  { id: 'social-media-content-generation', name: 'Social Creative Studio', category: 'create', description: 'Generate finished social concepts, captions, carousels, and production-ready video briefs.', stage: 'planned' },
  { id: 'social-media-content-calendar-strategy', name: 'Social Content Planner', category: 'market', description: 'Plan and organize the rolling social content schedule.', stage: 'planned' },
  { id: 'social-media-manager', name: 'Social Media Manager', category: 'market', description: 'Manage organic social strategy, community, growth, and audits.', stage: 'planned' },
  { id: 'social-media-analytics', name: 'Social Analytics', category: 'analyze', description: 'Analyze connected social performance and identify what to improve.', stage: 'planned' },
  { id: 'social-presentation', name: 'Social Preview', category: 'create', description: 'Render platform-accurate previews before publishing.', stage: 'planned' },
  { id: 'social-media-research-script', name: 'Social Research', category: 'analyze', description: 'Research trends and turn them into data-backed content opportunities.', stage: 'planned' },
  { id: 'email-outreach', name: 'Email Outreach', category: 'sell', description: 'Design and, with explicit confirmation, execute customer and outreach sequences.', stage: 'planned' },
  { id: 'ad-manager', name: 'Ad Manager', category: 'market', description: 'Plan, preview, and—with explicit spend confirmation—manage paid Meta and Google campaigns.', stage: 'planned' },
  { id: 'performance-report', name: 'Performance Report', category: 'analyze', description: 'Analyze marketing and growth performance across channels and funnels.', stage: 'planned' },
  { id: 'supportee', name: 'Customer Support', category: 'support', description: 'Provide consistent customer support using the business knowledge captured by HLai.', stage: 'planned' },
  { id: 'seedance-2-0', name: 'Video Studio', category: 'create', description: 'Create production-ready video concepts and generation workflows.', stage: 'planned' },
]

export const HLAI_BUILD_CATEGORIES = [
  { id: 'build', label: 'Build', description: 'Create the product, website, app, and business systems.' },
  { id: 'market', label: 'Market', description: 'Plan and execute organic and paid growth.' },
  { id: 'sell', label: 'Sell', description: 'Turn attention into customers with offers, email, and conversion assets.' },
  { id: 'create', label: 'Create', description: 'Produce written, visual, social, and video assets.' },
  { id: 'analyze', label: 'Analyze', description: 'Understand competitors, performance, and opportunities.' },
  { id: 'support', label: 'Support', description: 'Help customers consistently and professionally.' },
  { id: 'automate', label: 'Automate', description: 'Connect repeatable business work into workflows.' },
] as const
