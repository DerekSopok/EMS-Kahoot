# Changelog

All notable changes to EMS Kahoot will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial agent handoff system for AI-assisted development
- AGENT_CONTEXT.md for session state tracking
- ARCHITECTURE.md for comprehensive system design documentation
- ROADMAP.md for development phase tracking
- CHANGELOG.md for version history
- .agent-instructions/ directory with agent-specific coding guidelines
- Added unit tests covering validation utilities and player removal answer tracking.
- Added admin quiz CRUD API, category listing, and validation utilities for quiz management.
- Added admin API documentation for quiz management endpoints.
- Added admin dashboard and quiz editor UI for managing quizzes and questions.
- Added admin image upload API and quiz editor support for question images.

### Changed
- Archived legacy Postgres migration/seed tooling and updated deployment guidance.
- Consolidated game session state to `GameManager` and updated Socket.IO flows.

### Deprecated
- Nothing yet

### Removed
- Build pipeline no longer runs migration/seed steps.
- Legacy Socket.IO handlers, MongoDB wiring, and unused legacy UI flows.

### Fixed
- Added socket input validation for display names, room codes, answers, and response times.
- Prevented player removal from leaving stale answer tracking state.
- Serialized quiz JSON writes to avoid lost updates during concurrent edits.

### Security
- Added admin token authentication for admin APIs and hardened quiz rendering against XSS.

---

## [0.1.0] - 2026-02-01

### Added
- Forked base repository from kahoot-clone-nodejs
- Initial project structure with Express.js and Socket.IO
- Basic multiplayer game functionality
- MongoDB integration for quiz storage
- Real-time player synchronization
- Host and player interfaces
- Question display and answer submission
- Scoring system with time bonuses
- Leaderboard display

### Known Issues
- Uses MongoDB instead of target PostgreSQL database
- jQuery dependency should be removed
- Callback-based code needs modernization to async/await
- Missing error handling in several socket event handlers
- No authentication system
- No quiz creation interface
- Limited to basic multiple choice questions

---

## [0.0.0] - 2026-02-01

### Added
- Project initialized from kahoot-clone-nodejs fork
- Repository created at DerekSopok/EMS-Kahoot

---

## Version History Notes

### Version Number Format: MAJOR.MINOR.PATCH

- **MAJOR**: Breaking changes (incompatible API changes)
- **MINOR**: New features (backwards-compatible)
- **PATCH**: Bug fixes (backwards-compatible)

### Release Tags
- Use semantic versioning tags: v0.1.0, v0.2.0, etc.
- Use descriptive tags for major milestones: v1.0.0-mvp, v2.0.0-postgresql-migration

---

## Upcoming Releases

### [0.2.0] - Planned
**Target Date**: February 15, 2026

**Planned Features**:
- PostgreSQL database integration
- Database migration system
- Sample EMS question seeds
- Improved error handling
- Code modernization (async/await)

### [0.3.0] - Planned
**Target Date**: March 1, 2026

**Planned Features**:
- Educator authentication system
- Quiz creation interface
- Quiz editing functionality
- Image upload support for questions
- Question bank management

### [1.0.0] - MVP Release - Planned
**Target Date**: March 25, 2026

**Planned Features**:
- Production deployment on Render.com
- Complete EMS question library (100+ questions)
- Mobile-optimized interface
- QR code game joining
- Analytics dashboard
- Comprehensive documentation

---

## Development Notes

- All changes should be documented in this file
- Each pull request should update the [Unreleased] section
- Version bumps should move [Unreleased] items to a new version section
- Always include the date in ISO 8601 format (YYYY-MM-DD)
- Link to GitHub issues/PRs where applicable
