# @yuihub/core

**共有型定義パッケージ for YuiHub**

YuiHub の各パッケージで使用される TypeScript 型定義を提供します。

## インストール

```bash
npm install @yuihub/core
# or
pnpm add @yuihub/core
```

## 型定義

### Entry (メモリエントリ)

```typescript
interface Entry {
  id: string; // ULID
  date: string; // ISO 8601
  text: string;
  mode: "private" | "public";
  tags?: string[];
  session_id?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}
```

### Checkpoint (意思決定アンカー)

```typescript
interface Checkpoint {
  id: string;
  entry_id: string;
  snapshot: {
    working_memory: string;
    decision_rationale: string;
  };
  created_at: string;
}
```

### Session (セッション)

```typescript
interface Session {
  id: string;
  title: string;
  created_at: string;
  last_updated: string;
  entries_count: number;
}
```

## 使用例

```typescript
import type { Entry, Checkpoint, Session } from "@yuihub/core";

const entry: Entry = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  date: new Date().toISOString(),
  text: "My thought",
  mode: "private",
};
```

## ライセンス

MIT
