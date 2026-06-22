## Intelligence Testing

The repo already uses `node:test`, so the Intelligence coverage runs without adding a new framework.

### Run only Intelligence tests

```bash
npm run test:intelligence
```

### Run the full suite

```bash
npm test
```

### Current Intelligence coverage

- Paper normalization
- Deduplication by DOI
- Deduplication by arXiv ID
- Strategic signal generation with evidence
- No signal generation without evidence
- Admin protection on Intelligence API routes
- Topic CRUD
- Source enable/disable
- Sync dry-run without persistence
- Empty-state rendering for the Intelligence overview UI
