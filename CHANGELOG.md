# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.5] - 2024-03-24

### Added
- **Multi-SDK Workflow Documentation**: Complete workflow guide supporting TypeScript, Python, and Go SDKs with interactive tabs
- **Integration Testing Suite**: Automated integration tests for backend and frontend (`test-integration.sh` and `test-integration.ps1`)
- **Comprehensive Integration Documentation**: 
  - `INTEGRATION_TEST.md` - Detailed integration testing guide
  - `BACKEND_FRONTEND_INTEGRATION.md` - Complete architecture and data flow documentation
- **One-Command Installation**: Simplified setup with `npx @lelu-auth/lelu init`
- **Bundled UI in SDK**: Prisma Studio-like experience - UI bundled in npm package, no Docker required for Studio
- **SDK Feature Parity**: All three SDKs (TypeScript, Python, Go) now have 100% feature parity
- **Enhanced Documentation**:
  - Multi-language code examples across all docs
  - Updated quickstart guide with SDK-specific instructions
  - Improved CLI commands documentation
  - Better installation guides

### Changed
- **Simplified Local Setup**: Docker-first approach with CLI fallback for local-only deployment
- **Updated Homepage**: Featured one-command setup prominently with "Recommended" badge
- **Improved Studio Command**: `lelu studio` now works like `prisma studio` - opens immediately from bundled files
- **Better Error Messages**: More helpful guidance when services are not available

### Fixed
- Policy edit button functionality in UI
- Policy safety simulator integration with backend
- API integration between frontend and backend services
- Client-side API key exposure (moved to server-side proxy routes)

### Documentation
- Added comprehensive workflow guide with Prisma-inspired step-by-step pattern
- Created integration testing documentation
- Updated README with Quick Start section
- Added backend/frontend integration architecture guide
- Improved installation documentation across all platforms

### Infrastructure
- Enhanced docker-compose configuration for better local development
- Added health checks for all services
- Improved service startup reliability
- Better environment variable management

## [0.0.4] - Previous Release

### Added
- Initial release with core authorization features
- Confidence-aware authorization
- Policy evaluation (YAML and Rego)
- Human-in-the-loop review queue
- Behavioral analytics
- Audit trail
- Multi-language SDK support

---

For more details, see the [full documentation](https://lelu-ai.com/).
