# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.1] - 2026-01-18

### Added

- MCP Server automatic installation command for Antigravity/Cursor
- Language Model Tools API integration (5 tools for Copilot/Antigravity)
  - `yuihub_save_thought`
  - `yuihub_search_memory`
  - `yuihub_start_session`
  - `yuihub_fetch_context`
  - `yuihub_create_checkpoint`
- File-based Handshake authentication (`~/.yuihub/.token`)
- Create Checkpoint command

### Changed

- Default API port: 3000 → 4182
- Minimum VSCode version: 1.104.0 (Language Model Tools API required)
- Architecture: Offline Context (local-first) approach

## [0.0.9] - 2026-01-17

### Changed

- Update VSCode engine to 1.108.0
- Security updates

## [0.0.8] - 2026-01-16

### Changed

- Update VSCode engine to 1.107.0
- Security updates

## [0.0.7] - 2026-01-15

### Security

- Security updates

## [0.0.6] - 2026-01-14

### Added

- Search results view (Tree View)
- Clear command for search results

### Changed

- Remove activationEvents
- Update dependencies (esbuild, @vscode/vsce)

## [0.0.5] - 2026-01-13

### Changed

- Update VSCode engine to 1.106.0

## [0.0.4] - 2026-01-12

### Changed

- Update VSCode engine to 1.104.0

## [0.0.3] - 2026-01-11

### Fixed

- Remove unnecessary packaging

## [0.0.2] - 2026-01-10

### Added

- Workspace Trust support
- SecretStorage for API key management
- Search result insertion via QuickPick

### Security

- Limited mode for untrusted workspaces

## [0.0.1] - 2026-01-09

### Added

- Initial release
- Basic YuiHub API integration (/health, /search, /threads/new, /save)
- Settings and smoke test
