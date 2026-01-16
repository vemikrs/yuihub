---
doc_type: design
status: draft
owner: vemikrs
created: 2025-09-21
updated: 2026-01-17
concept_version: c1.0
doc_version: 1.0.0
---

# YuiHub Architecture Specification (V1)

## 1. Local RAG Architecture (Private-First)

> [!IMPORTANT]
> YuiHub uses **Local RAG (Retrieval-Augmented Generation)**.
> It enables autonomous context recall without external server dependencies.

### 1.1 Search Engine

| Item      | Specification                      |
| --------- | ---------------------------------- |
| Engine    | **LanceDB** (Vector Search)        |
| Package   | **`lancedb`** (npm)                |
| Method    | Embedding-based Semantic Search    |
| Update    | Real-time Incremental Update       |
| Embedding | **all-MiniLM-L6-v2** (Local Model) |

### 1.2 Chunking Strategy

| Item     | Specification                         |
| -------- | ------------------------------------- |
| Strategy | **Semantic Chunking** via Tree-sitter |
| Unit     | Function / Class / Method             |
| Metadata | Symbol Name, Type Info, Scope         |

---

## 2. ICD (Boundaries)

- GPTs → YuiHub（/save）: `InputMessage{ …, mode: "private" }` POST. Returns `RecordEntry{ …, mode: "private" }`.
- Client → YuiHub（/search）: **Vector Search**. Returns `RecordEntry[]{ …, mode: "private" }`.
- YuiHub → Agent（/trigger）: `AgentTrigger{ …, mode: "private" }` POST. `{ ok, ref }`.

### Error Model

- `400` Validation Error
- `401` Unauthorized
- `429` Rate Limit
- `500` Unexpected

## 3. HTTP API (Minimum)

- POST /save
- GET /search?q=...&tag=...&session=...
- POST /trigger

## 4. Security

- AUTH_TOKEN (Bearer)
- Rate Limit (Lenient for Private Mode)

## 5. Contract Testing

- `contracts/*.json`
- Execution: `yuihub_api/tests/contract/`
