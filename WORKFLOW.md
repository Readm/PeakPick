# PeakPick 开发工作流

## 核心理念：你决策，我执行

```
你 ── 定义方向 + Review 确认
 │
 ▼
Hermes ── 规划 → 实现 → 测试 → 截图 → 审查报告
 │                                          │
 ▼                                          ▼
GitHub                                    Pull Request / 消息
```

**你的工作量：** 每轮迭代约 10-15 分钟 Review
**我的工作量：** 规划、编码、测试、截图、生成审查报告

---

## 角色系统

本工作流定义 5 个专家角色，每次修改由多个角色交叉审查：

| 角色 | 职责 | 审查方式 |
|---|---|---|
| **Architect**（架构师） | 系统结构设计、数据流、模块边界 | 静态分析 + 文本报告 |
| **Code Reviewer**（代码审查） | 代码质量、异常处理、安全、模式合规 | 自动静态分析 + LLM 审查 |
| **QA Engineer**（测试工程师） | 单元测试、集成测试、回归测试 | 自动运行 + 覆盖率报告 |
| **UX Reviewer**（交互审查） | 界面布局、交互流程、视觉一致性 | 截图 + 人工 Review |
| **Tech Lead**（技术主管） | 架构决策审批、技术选型确认 | Reviewer 汇总 + 你最终确认 |

---

## 迭代流程（每轮一个 Cycle）

```
  ┌──────────────────────────────────┐
  │  Cycle N                         │
  │                                  │
  │  ① Plan    ── 写计划到 .hermes/ │
  │  ② Build   ── 实现所有代码      │
  │  ③ Auto-Test ── 全自动测试      │
  │  ④ Review ── 多角色审查报告     │
  │  ⑤ You Review ── 你看+确认      │
  │  ⑥ Merge   ── 合并/交付         │
  │                                  │
  └──────────→ 下一 Cycle ──────────┘
```

### Phase ① Plan — 规划

每轮先写一份计划文件到 `.hermes/plans/`：

```
.hermes/plans/YYYY-MM-DD-<cycle-name>.md
```

内容包含：
- **目标** — 本轮做什么，为什么
- **决策点** — 需要你确认的关键决策
- **我直接决策的事项** — 我有把握的决策 + 理由
- **任务列表** — 具体到文件路径的修改清单
- **测试策略** — 如何验证本次改动

Plan 由我起草，你可以回复"开始"或提修改意见。

### Phase ② Build — 实现

- 严格按 Plan 实现
- 修改遵循 [AGENTS.md](AGENTS.md) 中的编码规范
- 每个新功能都附带测试
- 前端组件实现后自动截图

### Phase ③ Auto-Test — 自动测试

```bash
# 1. 前端类型检查
npm run typecheck

# 2. 前端测试
npm run test

# 3. 后端测试
cd ml-backend && pytest

# 4. 代码质量检查（运行 review.py）
python3 scripts/review.py

# 5. 构建验证
npm run build
```

所有测试必须通过才能进入 Review。

### Phase ④ Review — 多角色自动审查

运行 `python3 scripts/review.py` 生成审查报告。报告包含：

**Architect Review**
- 模块依赖分析（是否有循环依赖）
- 数据流完整性（修改是否影响全链路）
- 架构边界检查

**Code Review**
- 异常处理检查（禁止 `except: pass`）
- 代码质量分析（魔法数、TODO、重复代码）
- Rust/Python/TypeScript 最佳实践

**QA Review**
- 测试覆盖率变化
- 新增测试是否覆盖边界条件
- 回归测试结果

**UX Review（前端改动时）**
- 截图对比（before/after）
- 交互流程描述
- 布局/响应式检查

### Phase ⑤ You Review — 你确认

我通过消息/PR 向你呈现：

1. **审查报告摘要** — 所有角色审查结果的精简版
2. **截图**（前端改动）— 截屏 + 标注
3. **决策汇报** — 本轮我自主做的决策 + 原因
4. **待确认事项** — 需要你拍板的点

你可以回复：
- ✅ **批准** — 我合并
- 🔄 **调整** — 具体的修改要求，我执行
- ❌ **否决** — 我撤销，从 Phase ① 重新规划

### Phase ⑥ Merge — 交付

- 代码合并到 main 分支
- 标签标记完成
- 进入下一 Cycle

---

## 前端截图规范

所有前端改动都必须附带截图。截图流程：

```bash
# 启动 Vite 开发服务器（后台）
npm run dev &

# 等待服务器就绪后，运行截图脚本
python3 scripts/screenshot.py
```

截图输出到 `screenshots/` 目录，文件命名：
```
screenshots/<cycle-name>/<component-name>-<state>.png
```

状态包括：`default` `hover` `active` `empty` `loading` `error`

---

## 我的决策权限

以下事项我可以**直接决策**，在 Review 时汇报即可：

| 领域 | 可以决策 | 需要你确认 |
|---|---|---|
| 技术栈选型 | 同一生态内的选择（ESLint 配置、npm 包选择） | 跨生态/重大架构变更 |
| UI 细节 | 间距、颜色微调、组件内部布局 | 整体设计方向、品牌风格 |
| 测试策略 | 单元测试框架、mock 策略 | 测试覆盖目标 |
| 命名规范 | 变量/函数/组件命名 | 公开 API、URL 路径、数据库 schema |
| 代码组织 | 文件拆分、模块内部结构 | 模块边界、包结构 |

---

## 文档更新

本工作流本身也接受迭代。如果流程中发现：
- 某步可以更自动化
- 角色检查不够深入
- 有更好的流程

请在 Review 中提出，我更新 `WORKFLOW.md` 并提交。

---

## Cycle 状态追踪

每轮 Cycle 完成后更新 `CHECKLIST.md`：
- Cycle 名称和日期
- 完成的功能清单
- 尚未解决的问题
- 下一轮计划
