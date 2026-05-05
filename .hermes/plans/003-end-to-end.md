# Cycle 003 — 端到端集成 ML 后端 + 前端联调

## 目标
将前端 React 应用连接到真正的 Python ML 后端，实现导入→评分→展示的完整流程。替换模拟数据为真实文件操作。

## 任务列表

### 1. Python 后端 — 完整 REST API 实现
- [ ] 重写 `ml-backend/peakpick_ml/server.py`，暴露项目 API spec 定义的全部端点
- [ ] 添加 SQLite 数据库层（`db.py`）— 初始化、CRUD
- [ ] 文件扫描逻辑（`scanner.py`）— 递归遍历目录，过滤图片扩展名
- [ ] 缩略图生成（`thumbnails.py`）— PIL 缩放到 400px 宽边
- [ ] 图片元数据提取（EXIF 日期、分辨率、文件大小）
- [ ] 基础美学评分（`scorer.py`）— 无需 torch 的启发式评分（亮度、对比度、清晰度、色彩丰富度）
- [ ] 在线学习日志 — 记录用户反馈到 feedback_log 表
- [ ] ML 状态端点 — 返回模型配置、已评分数量、已学习样本数
- [ ] 启动脚本 — `ml-backend/run.sh`

### 2. 前端 API 客户端
- [ ] 创建 `src/api.ts` — 封装所有后端 HTTP 调用
- [ ] 错误处理和重试逻辑
- [ ] 连接检测（轮询 `/api/ml/status`）

### 3. Tauri 集成
- [ ] 添加 `tauri-plugin-fs` 和 `tauri-plugin-dialog`
- [ ] Tauri 命令：选择文件夹（原生对话框）
- [ ] Tauri 命令：启动/停止 Python 后端进程
- [ ] Tauri 命令：读取图片文件并返回 base64

### 4. 前端状态重构
- [ ] 修改 `PhotoCard.tsx` — 用真实 `<img>` 替换彩色占位符
- [ ] 修改 `usePhotoStore` — 从 `src/api.ts` 获取真实数据
- [ ] 添加加载状态
- [ ] 修改 `ImportOverlay` — 调用真实的扫描和导入 API

### 5. 测试
- [ ] 后端测试 — 每个端点一个测试
- [ ] 前端 API 客户端测试（mock fetch）

## 交付物
- 启动的 Python ML 后端（localhost:7878）
- 前端连接到后端实时数据
- 真实图片在 grid 和 detail 中显示
- 导入流程：选择文件夹 → 扫描 → 评分 → 展示
- 全部测试通过

## 优先级
1. Python 后端 DB + API（基础设施）
2. Python 后端扫描 + 评分（核心功能）
3. 前端 API 客户端 + 状态重构（连接）
4. Tauri 集成命令（原生交互）
5. 图片展示（视觉验证）
6. 测试
