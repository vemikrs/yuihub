# YuiHub Data Directory Structure

## Overview
YuiHub Phase 2では、データを「マスタ系」と「トランザクション系」に分離し、Git管理とファイルシステム管理を明確に区分します。

## Directory Structure

```
data/
├── chatlogs/        # 🔒 Master Data (Git-tracked)
│   └── 2025/
│       └── 09/
│           └── *.md # User chat conversations
└── index/           # 🔄 Transaction Data (Generated, Git-ignored)
    ├── lunr.idx.json     # Lunr search index
    ├── documents.json    # Document metadata
    ├── stats.json        # Search statistics
    ├── terms.json        # Full term frequency
    └── terms-quick.json  # Quick lookup terms
```

## Data Classification

### 🔒 Master Data (`chatlogs/`)
- **Purpose**: ユーザー会話ログの永続保存
- **Git Status**: ✅ Tracked (version controlled)
- **Characteristics**:
  - Human-generated content
  - YAML Front-Matter + Markdown format
  - Immutable once created
  - Long-term preservation required
  - Manual editing possible

### 🔄 Transaction Data (`index/`)
- **Purpose**: 検索・分析用の派生データ
- **Git Status**: ❌ Ignored (`.gitignore`で除外)
- **Characteristics**:
  - Machine-generated from master data
  - JSON format for fast access
  - Regeneratable from chatlogs
  - Performance-optimized
  - No manual editing needed

## File Lifecycle

### Master Data Flow
```
User Input → API /save → chatlogs/*.md → Git commit
```

### Transaction Data Flow
```
chatlogs/*.md → build-index script → index/*.json → API /search
```

## Regeneration Strategy

### Index Rebuild Process
1. **Full Rebuild**: `npm run build-all`
   - Scans all `chatlogs/*.md`
   - Generates fresh `index/*.json`
   - Updates statistics and terms

2. **Incremental Update**: 
   - Triggered by API server
   - Only processes changed files
   - Maintains index consistency

### Recovery Procedures
```bash
# Complete index regeneration
rm -rf data/index/*.json
npm run build-all

# Validate structure
npm run validate-structure

# Check index status
curl http://localhost:3000/health
```

## Environment Variables

### Production Configuration
```bash
DATA_ROOT="${workspaceFolder}/data"
LOCAL_STORAGE_PATH="${workspaceFolder}/data/chatlogs"
LUNR_INDEX_PATH="${workspaceFolder}/data/index/lunr.idx.json"
TERMS_INDEX_PATH="${workspaceFolder}/data/index/terms.json"
STATS_PATH="${workspaceFolder}/data/index/stats.json"
```

### Legacy Compatibility
- Old `chatlogs/` directory still exists for backward compatibility
- Phase 2+ uses unified `data/chatlogs/` structure
- Migration handled automatically by API server

## Security Considerations

### Data Separation Benefits
1. **Git Repository Size**: 生成ファイルを除外してリポジトリサイズ最小化
2. **Privacy Protection**: インデックスファイルに個人情報含まない
3. **Performance**: インデックス再構築が高速
4. **Backup Strategy**: マスタデータのみをバックアップ対象とする

### Access Control
- `chatlogs/`: Write access via API only
- `index/`: Read access for search operations
- Automatic cleanup of old index files
- No direct file system access from external systems

## Development Guidelines

### Adding New Data Types
1. **Master Data**: Add to `chatlogs/` with proper YAML Front-Matter
2. **Derived Data**: Add generation logic to `scripts/`
3. **Index Integration**: Update `enhanced-search.js` for new fields
4. **Git Management**: Update `.gitignore` for new generated files

### Performance Optimization
- Index files are memory-mapped for fast access
- Terms database enables prefix matching
- Statistics provide search result ranking
- Background rebuilds don't block API operations

## Monitoring & Maintenance

### Health Checks
```bash
# API health with index status
curl http://localhost:3000/health

# File system validation
npm run validate-structure

# Index rebuild status
curl http://localhost:3000/search?q=test
```

### Troubleshooting
| Issue | Solution |
|-------|----------|
| Search returns empty | Run `npm run build-all` |
| Index file missing | Check file permissions, rebuild index |
| Git repository bloated | Verify `.gitignore` excludes `data/index/` |
| API slow responses | Check index file sizes, consider cleanup |

---

## Phase 2 Implementation Status

- ✅ Data structure separation
- ✅ Unified environment variables  
- ✅ Automatic index management
- ✅ Git ignore optimization
- ✅ Enhanced search with terms integration
- ✅ Background processing support

**Last Updated**: Phase 2 Implementation (2025-09-18)