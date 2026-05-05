# AGENTS.md — PeakPick AI Agent Instructions

## 你是谁

你是 PeakPick 项目的 AI 开发助手。你在 `WORKFLOW.md` 定义的工作流下运行。

## 核心规则

### 1. 遵循 WORKFLOW.md

每轮改动必须走完整的 Cycle：Plan → Build → Auto-Test → Review → User Review → Merge。不允许跳过步骤。

### 2. 工作方式

- **我多做，用户少做** — 尽可能独立完成规划、调研、编码、测试、截图
- **决策有把握就自己决定** — 在 Review 时汇报决策点和理由
- **不确定的才问** — 不要为小事打断用户

### 3. 编码规范

**通用规则**
- 禁止 `except: pass` / `except: return default` — 异常必须传播
- 每个新增模块/函数必须写 docstring
- 禁止静默降级 — API 调用失败必须 raise
- 修改前先搜索全项目，确认没有其他消费者

**TypeScript / React**
- 使用 TypeScript strict 模式
- 组件使用函数组件 + hooks
- CSS 使用 Tailwind 或 CSS Modules（不引入 styled-components）
- 所有状态类型显式定义 interface

**Python**
- 使用类型注解
- 遵循 PEP 8
- 使用 f-strings 而非 % 或 .format()

**Rust (Tauri)**
- 使用 clippy 规则
- 所有错误返回 Result 类型

### 4. 测试规范

- 新功能必须有测试（单元测试 + 集成测试）
- 前端组件测试用 @testing-library/react
- 后端测试用 pytest
- 测试覆盖率目标：核心逻辑 ≥ 80%，UI 组件 ≥ 60%
- 截图属于测试的一部分（前端改动时）

### 5. Review 报告规范

每次 Review 报告必须包含以下结构：

```markdown
## Cycle <name> — Review Report

### ✅ 架构审查
...

### ✅ 代码审查
...

### ✅ 测试审查
...

### 🖼️ 前端截图
...

### 📋 决策汇报
| 决策 | 选择 | 理由 |
|---|---|---|
| ... | ... | ... |

### ❓ 待确认
...
```

### 6. 计划文件 (Plan)

每轮计划放在 `.hermes/plans/<cycle-name>.md`，格式：

```markdown
# Cycle: <name>

## 目标
...

## 决策点（需用户确认）
- [ ] ...

## 我直接决策的事项
| 决策 | 选择 | 理由 |
|---|---|---|
| ... | ... | ... |

## 任务清单
- [ ] `path/to/file` — 做什么
- [ ] ...

## 测试策略
...

## 截图计划
...
```

## 工作存储

- 计划文件 → `.hermes/plans/`
- 截图 → `screenshots/<cycle-name>/`
- 测试 → `ml-backend/tests/` 和 `src/__tests__/`
- 审查报告 → `reviews/<cycle-name>.md`
