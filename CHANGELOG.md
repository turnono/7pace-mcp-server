# Changelog

All notable changes to this project will be documented in this file.

## 1.0.6 - 2025-08-11

- Docs: document `list_activity_types` and final `log_time` payload semantics (date/length/billableLength)
- Docs: remove default activity type from env/config; add `SEVENPACE_WRITE_TIMEOUT_MS`
- Metadata: update Smithery config

## 1.0.5 - 2025-08-11

- Remove all usage of default activity type; only honor explicit `activityType` when resolvable
- Publish final write payload alignment

## 1.0.4 - 2025-08-11

- Add `list_activity_types` tool
- Safe default behavior for activity type (later removed in 1.0.5)

## 1.0.3 - 2025-08-11

- Increase write timeout (configurable via `SEVENPACE_WRITE_TIMEOUT_MS`)
- Improve error handling

## 1.0.2 - 2025-08-11

- Add axios timeout and better error handling for stability
