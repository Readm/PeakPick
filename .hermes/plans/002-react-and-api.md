# Cycle 002 — React 组件 + API 规格

## 目标
将 v3 prototype 的 UI 设计实现为真实 React 组件，同时从前端使用角度倒推出后端 API 规格。

## 任务列表

### 1. TypeScript 类型定义
- [ ] `Photo` — id, filename, score (raw float), scoreLabel (formatScore), date, status (pending/kept/dismissed), locked, group, metadata (resolution, size)
- [ ] `PhotoGroup` — groupId, desc, memberIds, bestId
- [ ] `ScoreLabel` — 13-value union type
- [ ] `FilterState` — currentFilter, scoreThreshold, dateRange, showingDismissed, showingLocked, searchQuery
- [ ] `ImportResult` — count, dateRange, fileList
- [ ] 路径: `src/types.ts`

### 2. 工具函数模块
- [ ] `src/lib/score.ts` — formatScore, parseLabel, getBaseVariants, SCORE_LABELS
- [ ] `src/lib/dates.ts` — dateRangePresets, formatDateRange
- [ ] 带完整单元测试

### 3. React 组件树
```
App
├─ Sidebar
│  ├─ SidebarHeader (logo + title)
│  ├─ SidebarNav (nav items + counts)
│  ├─ DateRangeFilter (dual slider + presets)
│  └─ ScoreFilterNav (all / high / medium / low)
├─ MainArea
│  ├─ Header (view title, folder badge, import button)
│  ├─ FilterBar (search input, threshold slider, filter chips)
│  ├─ Content
│  │  ├─ PhotoGrid
│  │  │  └─ PhotoCard (thumbnail, score label, lock/dismiss actions)
│  │  └─ EmptyState
│  └─ Toolbar
│     ├─ SelectionControls (select all, clear, count)
│     ├─ BatchActions (dismiss, keep, lock)
│     ├─ PickTop9
│     └─ DeleteLowScore
├─ ImportOverlay (dialog, dropzone, scan summary)
└─ DetailOverlay
   ├─ DetailHeader (filename, position, close)
   ├─ DetailImage (prev/next arrows, large view)
   ├─ DetailSidebar
   │  ├─ ScoreDisplay (clickable, cycling n → n+ → n- → n)
   │  ├─ ScoreDistribution (5-bar histogram, clickable bars)
   │  ├─ SimilarGroup (group info, member thumbnails)
   │  ├─ Top5Collapsible (collapsible top-scoring photos)
   │  ├─ Metadata (filename, date, resolution, size, status)
   │  └─ DetailActions (lock, dismiss, keep)
   └─ KeyboardShortcuts (← → 1-5 L D Esc)
```

### 4. 状态管理
- [ ] React Context 或 Zustand store
- [ ] 状态: photos[], filter, detailIndex, selection
- [ ] Actions: importPhotos, updateScore, toggleLock, dismiss, keep, batchDelete, selectTop9

### 5. API 接口规格 (OpenAPI 3.0)
从前端使用逆推，定义端点:

| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/photos` | GET | 带筛选查询(score, date, status, search) |
| `/api/photos/:id` | GET | 单个相片详情 |
| `/api/photos/import` | POST | 扫描文件夹，返回待导入列表 |
| `/api/photos/import/confirm` | POST | 确认导入，触发 AI 评分 |
| `/api/photos/:id/score` | PATCH | 用户修正评分 → 触发在线学习 |
| `/api/photos/:id/lock` | POST | 锁定/解锁 |
| `/api/photos/:id/status` | PATCH | pending/kept/dismissed |
| `/api/photos/batch/delete` | POST | 批量删除低于阈值(排除锁定) |
| `/api/photos/batch/status` | PATCH | 批量修改状态 |
| `/api/photos/similar` | GET | 相似组列表 |
| `/api/scores/distribution` | GET | 分数分布计数 |
| `/api/ml/status` | GET | 后端模型状态 |

- 输出: `docs/api-spec.yaml` (OpenAPI 3.0)

### 6. SQLite Schema
- [ ] `photos` 表 (id, filename, path, score, status, locked, date_taken, width, height, file_size, created_at, updated_at)
- [ ] `photo_groups` 表 (group_id, photo_id, description)
- [ ] `feedback_log` 表 (id, photo_id, old_score, new_score, timestamp)
- [ ] `ml_model_state` 表 (version, type, last_trained, metadata)

### 7. 测试
- [ ] `src/lib/score.test.ts` — formatScore(2.8)='3-', parseLabel('3+')=3.333, cycle order
- [ ] `src/lib/dates.test.ts`
- [ ] `src/components/PhotoCard.test.tsx` — renders score label, click cycles
- [ ] `src/components/ScoreDistribution.test.tsx` — 5 bars, clickable

## 交付物
- `src/types.ts`
- `src/lib/score.ts` (+ test)
- `src/lib/dates.ts` (+ test)
- `src/components/` — 所有组件
- `docs/api-spec.yaml`
- DB schema (`migrations/001_init.sql`)
- 所有测试通过 ✅

## 优先级
1. 类型定义 + 工具函数 (基础)
2. PhotoGrid + PhotoCard (核心视图)
3. DetailOverlay + 评分交互 (核心交互)
4. Sidebar + FilterBar (浏览)
5. ImportOverlay (导入流程)
6. Toolbar (批量操作)
7. API spec + DB schema (后端规格)
8. 测试 (贯穿始终)
