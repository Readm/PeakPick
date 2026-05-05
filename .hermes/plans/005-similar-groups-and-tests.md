# Cycle 005 — 相似组检测 + 组件测试

## 目标
实现感知哈希相似组检测（完成 UI 中存在的 SimilarGroup 组件），同时填补组件级测试空白。

## 任务列表

### 1. 后端 — 感知哈希相似组检测
- [ ] `ml-backend/peakpick_ml/hasher.py` — 感知哈希（pHash + dHash）实现
  - 计算图片的 pHash（64位感知哈希）
  - 计算图片的 dHash（差异哈希，更快）
  - 汉明距离计算函数
  - 相似度阈值（汉明距离 ≤ 10 视为同组）
- [ ] 更新 `server.py` — 导入图片时计算 hash 并检测相似组
  - `POST /api/photos/import/confirm` 中调用 hasher
  - `GET /api/photos/similar` 返回真实数据
- [ ] 更新 `db.py` — 添加相似组 CRUD
  - 创建/更新 photo_group_members
  - 查询组信息

### 2. 前端 — 连接相似组 API
- [ ] 更新 `api.ts` — `fetchSimilarGroups` 返回类型对齐
- [ ] 更新 `store.ts` — 加载相似组数据到 photo.group
- [ ] UI 更新 — SimilarGroup 组件展示真实数据

### 3. 组件测试
- [ ] `src/components/PhotoCard.test.tsx`
- [ ] `src/components/ScoreDistribution.test.tsx`
- [ ] `src/components/FilterBar.test.tsx`
- [ ] `src/components/SimilarGroup.test.tsx`
- [ ] `src/components/Toolbar.test.tsx`

### 4. 测试验证
- [ ] 后端哈希测试（pHash、dHash、汉明距离）
- [ ] 相似组 API 测试
- [ ] 前后端所有测试通过

## 交付物
- 完整的相似组检测（导入时自动计算 + DB 存储 + API 查询）
- SimilarGroup UI 显示真实数据
- 5 个组件测试文件
- 全部 70+ 测试通过
- TypeScript 零错误 + cargo check 通过
