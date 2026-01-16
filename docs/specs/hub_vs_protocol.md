---
doc_type: concept
status: draft
owner: vemikrs
created: 2025-09-21
updated: 2026-01-17
concept_version: c1.0
doc_version: 1.0.0
---

# YuiHub vs YuiFlow Separation Principles

## Definition

- **YuiHub (Engine)**: The Runtime Entity (API / Storage / Search / Embedding).
- **YuiFlow (Protocol)**: The Specification (Schema / Contract / Interface).

## Responsibility Matrix

| Domain         | YuiFlow (Protocol)   | YuiHub (Engine)         |
| -------------- | -------------------- | ----------------------- |
| Schema / ICD   | ✓ Primary Definition | - Implementation        |
| Contract Test  | ✓ Definition         | - Execution             |
| **Embedding**  | -                    | **✓ Generation & Mgmt** |
| Language Norms | ✓ Guidelines         | - Tokenizer Logic       |
| Storage        | -                    | ✓ Persistence (LanceDB) |

## Dependency Direction

- Engine → Protocol (Conformance)
- Protocol ↛ Engine (Independence)

## Anti-Goals

- Protocol must not contain Engine implementation details.
- Engine must not define Primary Specifications.

## Implementation Mapping

| Principle (Protocol)     | Specification Element | Implementation (Engine)   | Verification             |
| ------------------------ | --------------------- | ------------------------- | ------------------------ |
| **Private Mode** Default | `min-spec.md`         | Request/Record Validation | Contract Test + API Test |
| **Session** Required     | `min-spec.md`         | Mandatory Field on Save   | Consistency Check        |
| **Context Packet** Def   | `min-spec.md`         | Request/Response Design   | Contract JSON Schema     |
| Vector Search            | `architecture.md`     | LanceDB Integration       | Search Accuracy Test     |

> **Operational Note:**
> Primary Truth lies in the Protocol. Optimizations in the Engine must be reflected back to the Protocol if they affect the interface.
