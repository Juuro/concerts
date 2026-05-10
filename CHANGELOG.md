# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [Unreleased]

### Added

- In-app feedback flow with `POST /api/feedback` and `FeedbackModal` UI for bug reports, feature requests, and general feedback.
- Database persistence for feedback submissions via `AppFeedback` model and migration.
- Shared Zod validation schema and unit tests for feedback payload validation.
- Admin feedback operations workspace (`/admin/feedback`) with queue/list triage controls.
- Admin APIs for feedback queue and detail triage updates (`/api/admin/feedback*`).
- GitHub issue escalation endpoint for feedback items (`POST /api/admin/feedback/[id]/github`).
- GitHub issue **open/closed** state on `AppFeedback` (`githubIssueState`, `githubSyncedAt`) with `POST /api/admin/feedback/[id]/github/sync` and optional daily cron `GET /api/cron/feedback-github-sync` (Bearer `CRON_SECRET`).
- Feedback queue **`queue=active` | `all`**: default Active inbox hides Done, Discarded, and GitHub-closed linked items.
- Optional env **`FEEDBACK_GITHUB_CLOSE_SETS_DONE`**: when a sync finds the GitHub issue closed, triage can auto-move to Done (audit logged).

### Changed

- `app/SessionAwareShell.tsx` now mounts the global feedback trigger/modal.
- `app/privacy/page.tsx` now documents product feedback processing purpose and retention period.
- `prisma/schema.prisma` now includes feedback enum/model relations.
- `prisma/schema.prisma` now includes feedback triage metadata (status, priority, owner, notes, GitHub links).
- Admin feedback UI restyled (Pink Ink Editorial): single dashboard surface, Inbox/Detail panes, Active/All toggle, GitHub status pill and refresh.

## [1.0.0](https://github.com/Juuro/concerts/compare/v0.3.0...v1.0.0) (2022-12-03)


### Features

* band page ([a911ceb](https://github.com/Juuro/concerts/commit/a911ceb085fc5ef05442e6bf316eeee5443b6f46))
* concert count component ([7ff256b](https://github.com/Juuro/concerts/commit/7ff256b0b3be024ccbae5a7454f9e171d3543a59))
* geacoding without gatsby plugin ([7ccea63](https://github.com/Juuro/concerts/commit/7ccea63ed96baf4cc352a2fad698153b826504e1))
* Get that image right. ([354c8f5](https://github.com/Juuro/concerts/commit/354c8f5884cd41dcc96adfb4118642ea36345285))
* **map:** Leaflet map & support bands ([76e8725](https://github.com/Juuro/concerts/commit/76e8725e371aa6c3f67e0a8fa439964bfaafe1c9))


### Bug Fixes

* badge ([573b70b](https://github.com/Juuro/concerts/commit/573b70b1ca6fac9e37613b1a9a7da32fc79794bf))
* band page title ([#37](https://github.com/Juuro/concerts/issues/37)) ([40ec81f](https://github.com/Juuro/concerts/commit/40ec81f245200db85882871165cd49ab5ce66fdb))
* mobile views ([a9b934d](https://github.com/Juuro/concerts/commit/a9b934d026b4d53fc07781b2a4bfb436935719af))
* prettier ([468e0d1](https://github.com/Juuro/concerts/commit/468e0d1d06d793e3e28dc2db80d6371a86ea418f))
* upgrade prettier ([2aa04c8](https://github.com/Juuro/concerts/commit/2aa04c86272547b1d03998904e404491410f74f4))

## [0.3.0](https://github.com/gatsbyjs/gatsby-starter-default/compare/v0.2.0...v0.3.0) (2019-06-15)

### Features

- Styling. Without Bootstrap. ([ab478aa](https://github.com/gatsbyjs/gatsby-starter-default/commit/ab478aa))

## [0.2.0](https://github.com/gatsbyjs/gatsby-starter-default/compare/v0.1.0...v0.2.0) (2019-06-14)

### Bug Fixes

- Don't checkin yarn.lock. ([ed7a832](https://github.com/gatsbyjs/gatsby-starter-default/commit/ed7a832))

### Features

- Add standard-version. ([0d36e1e](https://github.com/gatsbyjs/gatsby-starter-default/commit/0d36e1e))
- Use openstage geocoder from personal GitHub repository. ([77a0cd3](https://github.com/gatsbyjs/gatsby-starter-default/commit/77a0cd3))

## 0.1.0 (2019-06-14)
