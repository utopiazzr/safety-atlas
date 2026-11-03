# Playback repair and public presentation

The public entry now uses the reviewed immersive cover, scroll-driven introduction,
poster catalogue, compact case detail and mechanism demonstration. Catalogue facts
still come from `data/signals.json`; `src/atlas/presentation.json` contains display
metadata. New approved records receive a default illustration rather than being
omitted. The existing community hub remains at `community.html#review`.

## Playback failures addressed

- The stage container had the same `data-step` attribute as the step buttons.
  The broad click selector bound it as another control, so a click on the art
  paused playback and sought to the beginning of the current scene. Only the
  four actual buttons receive that handler now.
- Playback depended on a delayed stage visibility observer. A start could be
  cancelled by stale visibility, or when the controls were in view but the stage
  was not. User-started playback now depends only on the current route and tab
  visibility. Route exit, page exit and hidden tabs pause it.
- Pauses cancel the sole frame callback and reset its time origin. Generation
  tokens discard stale callbacks after a restart. Seeking cancels playback;
  continuing resumes at the selected time. A full pass stops at its final frame.
- Reduced-motion preferences still suppress ambient animation. They no longer
  hide the explicit play control; users may also inspect individual scenes.
- The caption now sits below the artwork, and the signal travels above the node
  labels. A compact desktop layout keeps the play bar with the picture.
- All runtime imports and styles pass through Vite. Content-hashed assets replace
  manual query-string versioning; project-relative paths work on GitHub Pages.

## Service continuity and security

The new submission route mounts the existing CloudComposer and intake client,
including public/private consent, challenge verification, quota handling,
resumable uploads and receipt recovery. It stays mounted when changing routes
so a draft is not discarded. A shadow root isolates presentation CSS only; it is
not a security boundary. Existing CSP and backend authorization remain in force.
The former local-only JSON draft UI is not used for the public submission route.

No Actions permission, branch protection, secret or backend policy changes are
part of this release. The automatic PR permission remains disabled as requested.

## Verification

- Eight deterministic playback lifecycle regressions, alongside existing frontend
  and intake security suites.
- Production TypeScript/Vite build and asset entry validation.
- Browser checks on the built output at desktop and 390 px mobile widths:
  play, completion, replay, seek/continue, route changes, clicking the art,
  visible markers and a live submission form. No real public proposal is sent
  by these checks.

The art and introduction video were retained from the approved local design
preview. External research boards and user reference screenshots are not shipped.
