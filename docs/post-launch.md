# Post-launch list

Small, approved-in-principle changes deliberately held until after launch.
Each needs its own go-ahead before it is built.

## Interview screen: show Capture as done once the interview is finished

The dashboard and project page count Capture as done when
`interviews.status = 'completed'` or a project exists (`lib/hke/journey.ts`).
The interview screen still uses the older rule (done only once a project
exists), because it is never told the interview's status.

- Files: `app/builder/page.tsx` (select `status`, pass `interviewDone`) and
  `components/hke/InterviewWorkspace.tsx` (new optional `interviewDone` prop,
  passed to `buildJourney`). Both are part of the 15-question interview, which
  needs explicit approval to touch.
- Effect: rare. The interview is only marked finished just before a blueprint
  build, and the page redirects once a build exists, so it shows only after a
  build was cut off or refused.
- Held on 2026-10-22: not applied, by decision.

## More held items

- Align the old 5 levels on project/interview pages with the new jewels.
- Restyle the Plans section to match Crown (visual only, checkout untouched).
- Replace the "HKE AI" logo on login/register/homepage/browser tab with HKE.
- Replace the 🦋 emoji and drawn crown with sharp PNG art.
- Theme picker ("Crown" + a second sleeker theme).
