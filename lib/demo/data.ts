/**
 * Sample data for the local demo preview (see `./mode`). Invented for layout
 * review; none of it comes from, or is written to, a real account.
 */
const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString()

const USER_ID = '00000000-0000-4000-8000-000000000001'
const ID = {
  mainInterview: '00000000-0000-4000-8000-0000000000a1',
  mainProject: '00000000-0000-4000-8000-0000000000b1',
  secondInterview: '00000000-0000-4000-8000-0000000000a2',
  secondProject: '00000000-0000-4000-8000-0000000000b2',
  draftInterview: '00000000-0000-4000-8000-0000000000a3',
  archivedInterview: '00000000-0000-4000-8000-0000000000a4',
  archivedProject: '00000000-0000-4000-8000-0000000000b4',
}

// Every name below is a generic placeholder, labelled as a sample wherever it is shown.
const MAIN_TITLE = 'Sample Project — Advisory Practice'

export const DEMO_USER = {
  id: USER_ID,
  email: 'demo@hke-ai.example',
  email_confirmed_at: ago(24 * 30),
  app_metadata: {},
  user_metadata: { full_name: 'Demo Founder (sample)' },
  aud: 'authenticated',
  created_at: ago(24 * 30),
}

const mainAnswers: Record<string, string> = {
  '1': MAIN_TITLE,
  '2': 'We help small business owners understand a complicated process and follow it step by step.',
  '3': 'Owners of small businesses who are capable and busy, and who are doing this for the first time.',
  '4': 'They lose time and confidence because the process is confusing and the advice they find is generic.',
  '5': 'Plain-language guidance, a clear sequence of steps, and a named person to ask.',
  '6': 'A starter consultation, a guided programme, and ongoing monthly support.',
  '7': 'Calm, clear, and practical. No jargon.',
  '8': 'Simple and uncluttered, with plenty of white space.',
  '9': 'I kept explaining the same process to people one at a time and decided to write it down properly.',
  '10': 'Be clear, be honest about what is hard, and respect the customer’s time.',
  '11': 'Customers finish the process knowing what they did and why, and can repeat it themselves.',
  '12': '“For the first time I understood each step.” — sample testimonial',
  '13': 'Serve the first ten customers and turn the method into a repeatable programme.',
  '14': 'A website, an email newsletter, and one social channel.',
}

const mainContent = {
  elevator_pitch: 'Sample content for layout review: an advisory practice that turns a complicated process into clear, practical steps its customers can follow.',
  business_summary: 'A small advisory practice. Customers arrive unsure where to start; they leave with a plain-language plan, a sequence of steps, and someone to ask along the way.',
  ideal_customer: 'Busy small business owners facing an unfamiliar process for the first time, who want clear direction rather than more reading.',
  problem_solved: ['The process is confusing and the stakes feel high', 'Generic advice does not fit their situation', 'They do not know which step comes first'],
  differentiation: ['Plain-language guidance', 'One clear sequence of steps', 'A named person to ask'],
  products_services: ['Starter consultation', 'Guided programme', 'Ongoing monthly support'],
  customer_transformation: 'From unsure where to start to confident about each step and able to repeat it.',
  brand_voice: 'Calm, clear, and practical. No jargon.',
  origin_story: 'It began with explaining the same process to one person at a time, until writing it down properly became the obvious next step.',
  mission_values: ['Be clear', 'Be honest about what is hard', 'Respect the customer’s time'],
  goals_6_12_months: ['Serve the first ten customers', 'Turn the method into a repeatable programme', 'Publish a practical customer guide'],
  marketing_strategy: 'Answer the questions customers already ask, publish them as short guides, and invite readers to a starter consultation.',
  launch_roadmap: ['Weeks 1–2: offer and request form live', 'Weeks 3–6: first ten consultations', 'Weeks 7–12: publish the guide and open the programme'],
  next_steps: ['Define the launch target', 'Write the customer offer', 'Set up the customer foundation'],
  recommended_modules: [],
  launch_target: { audience: 'Small business owners new to the process', location: 'Online, one region to start', offer: 'A starter consultation', first_milestone: 'Sign the first 10 paying customers' },
  customer_offer: { service_name: 'Starter Consultation Package', customer_gets: 'One working session, a written plan, and two weeks of follow-up questions.', pricing: 'One fixed price, shown before booking.', booking: 'A short request form with goals, preferred time, and contact details.', next_action: 'Book a Consultation' },
}

const brandStory = `# Our Story (sample asset)

*Sample content for layout review. It does not describe a real business.*

## Origin

It started with one question, asked many times. The answer was always the same set of steps, explained a little differently for each person.

## What We Believe

- **Be clear.** If a step needs explaining twice, the explanation is the problem.
- **Be honest about what is hard.** Some steps take time, and we say so.
- **Respect the customer’s time.** Nothing is included that does not help.

## How We Work

1. We listen to where you are starting from.
2. We lay out the steps in the order that makes sense for you.
3. We stay available while you work through them.

> For the first time I understood each step.

## What This Means For Customers

You finish knowing what you did and why, and you can do it again without us.`

const sampleAnswers = (title: string, count: number) =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [String(index + 1), index === 0 ? title : 'Sample answer for layout review.']))

export const DEMO_TABLES: Record<string, Record<string, unknown>[]> = {
  subscriptions: [
    { user_id: USER_ID, plan: 'professional', status: 'active', interviews_used: 3, builds_used: 6, current_period_end: new Date(Date.now() + 18 * 86400_000).toISOString(), trial_started_at: ago(24 * 40) },
  ],
  interviews: [
    { id: ID.mainInterview, user_id: USER_ID, title: MAIN_TITLE, status: 'completed', progress: 93, messages: { version: 2, answers: mainAnswers, current: 14, archived: false }, created_at: ago(24 * 9), updated_at: ago(24 * 8) },
    { id: ID.secondInterview, user_id: USER_ID, title: 'Sample Project — Weekend Classes', status: 'completed', progress: 100, messages: { version: 2, answers: sampleAnswers('Sample Project — Weekend Classes', 15), current: 14, archived: false }, created_at: ago(24 * 3), updated_at: ago(30) },
    { id: ID.draftInterview, user_id: USER_ID, title: 'Sample Draft — Fitness Studio', status: 'in-progress', progress: 40, messages: { version: 2, answers: sampleAnswers('Sample Draft — Fitness Studio', 6), current: 6, archived: false }, created_at: ago(20), updated_at: ago(2) },
    { id: ID.archivedInterview, user_id: USER_ID, title: 'Sample Archived Project', status: 'completed', progress: 20, messages: { version: 2, answers: sampleAnswers('Sample Archived Project', 1), current: 1, archived: false }, created_at: ago(24 * 40), updated_at: ago(24 * 39) },
  ],
  projects: [
    { id: ID.mainProject, user_id: USER_ID, interview_id: ID.mainInterview, title: MAIN_TITLE, content: mainContent, status: 'completed', archived_at: null, entitlement_state: 'consumed', created_at: ago(24 * 8), updated_at: ago(5) },
    { id: ID.secondProject, user_id: USER_ID, interview_id: ID.secondInterview, title: 'Sample Project — Weekend Classes', content: { elevator_pitch: 'Sample content for layout review: weekend classes that teach beginners a practical skill in four sessions.', business_summary: 'Hands-on weekend classes for beginners, with a short follow-up programme.', ideal_customer: 'Beginners who have tried to learn on their own and want a structured start.' }, status: 'completed', archived_at: null, entitlement_state: 'consumed', created_at: ago(30), updated_at: ago(28) },
    { id: ID.archivedProject, user_id: USER_ID, interview_id: ID.archivedInterview, title: 'Sample Archived Project', content: { elevator_pitch: 'A sample archived project.' }, status: 'completed', archived_at: ago(24 * 30), entitlement_state: 'consumed', created_at: ago(24 * 39), updated_at: ago(24 * 30) },
  ],
  project_assets: [
    { id: '00000000-0000-4000-8000-0000000000c1', user_id: USER_ID, project_id: ID.mainProject, asset_type: 'brand_story', title: 'Our Story (sample asset)', content: brandStory, status: 'completed', version: 2, error_message: null, entitlement_state: 'consumed', metadata: {}, created_at: ago(24 * 2), updated_at: ago(5) },
    { id: '00000000-0000-4000-8000-0000000000c2', user_id: USER_ID, project_id: ID.mainProject, asset_type: 'brand_story', title: 'Our Story (sample first draft)', content: '# Our Story\n\nA shorter first version, kept for reference. Sample content.', status: 'completed', version: 1, error_message: null, entitlement_state: 'consumed', metadata: {}, created_at: ago(24 * 6), updated_at: ago(24 * 6) },
    { id: '00000000-0000-4000-8000-0000000000c3', user_id: USER_ID, project_id: ID.mainProject, asset_type: 'landing_page', title: 'Landing Page (sample asset)', content: '# A clear path through a complicated process\n\n*Sample content for layout review.*\n\n## The Problem\n\nThe process is confusing and generic advice does not fit.\n\n## The Solution\n\nA plain-language plan and a clear sequence of steps.\n\n- One working session\n- A written plan\n- Two weeks of follow-up questions', status: 'completed', version: 1, error_message: null, entitlement_state: 'consumed', metadata: {}, created_at: ago(24 * 4), updated_at: ago(24 * 4) },
    { id: '00000000-0000-4000-8000-0000000000c4', user_id: USER_ID, project_id: ID.mainProject, asset_type: 'faq', title: 'FAQ (sample asset)', content: '', status: 'failed', version: 1, error_message: 'The model took too long to respond.', entitlement_state: 'released', metadata: {}, created_at: ago(24 * 1), updated_at: ago(24 * 1) },
  ],
}

export const DEMO_LINKS = { project: `/projects/${ID.mainProject}`, draft: `/builder?interview=${ID.draftInterview}`, asset: `/projects/${ID.mainProject}/assets/00000000-0000-4000-8000-0000000000c1` }
