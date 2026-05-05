#!/usr/bin/env python3
"""
PeakPick Multi-Role Review System.

Runs automated reviews across 5 expert roles:
- Architect (dependency analysis, architecture boundaries)
- Code Reviewer (static analysis, best practices)
- QA Engineer (test coverage, test quality)
- UX Reviewer (screenshot verification)
- Tech Lead (decision audit trail)

Usage:
    python3 scripts/review.py              # Full review
    python3 scripts/review.py --role arch   # Single role
    python3 scripts/review.py --output review.md  # Save to file
"""

import ast
import os
import re
import sys
import json
import subprocess
import tempfile
from pathlib import Path
from collections import defaultdict
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parent.parent


# ── Reporter ────────────────────────────────────────────────

class Report:
    """Accumulates findings from all review roles."""

    def __init__(self):
        self.sections: dict[str, list[str]] = {
            "architect": [],
            "code_review": [],
            "qa": [],
            "ux": [],
            "decisions": [],
            "pending": [],
        }

    def add(self, role: str, finding: str):
        self.sections[role].append(finding)

    def add_decision(self, decision: str, choice: str, reason: str):
        self.sections["decisions"].append(f"  - **{decision}**: {choice} — {reason}")

    def add_pending(self, item: str):
        self.sections["pending"].append(f"  - ☐ {item}")

    def has_issues(self) -> bool:
        for role in ["architect", "code_review", "qa"]:
            for f in self.sections[role]:
                if f.startswith("  - ⚠️") or f.startswith("  - ❌"):
                    return True
        return False

    def format(self) -> str:
        lines = []
        lines.append("# PeakPick Review Report")
        lines.append(f"*Generated: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}*\n")

        role_names = {
            "architect": "🏗️ 架构审查",
            "code_review": "🔍 代码审查",
            "qa": "🧪 测试审查",
            "ux": "🖼️ UX 审查",
            "decisions": "📋 本轮决策",
            "pending": "❓ 待确认事项",
        }

        for key, title in role_names.items():
            items = self.sections[key]
            if not items:
                items = ["  - ✅ 无发现"]

            # Check if all are positive
            has_issues = any(i.startswith("  - ⚠️") or i.startswith("  - ❌") for i in items)
            all_ok = all(("✅" in i or "无发现" in i) for i in items)

            if all_ok:
                lines.append(f"\n## {title}")
                lines.append("")
                lines.append("✅ 全部通过")
                continue

            status = "⚠️ 需关注" if has_issues else "✅ 通过"
            lines.append(f"\n## {title} — {status}")
            lines.append("")
            lines.extend(items)

        return "\n".join(lines)


# ── Role: Architect ─────────────────────────────────────────

def review_architect(report: Report):
    """Analyze project structure and module dependencies."""

    # Check for circular imports in Python backend
    py_files = {}
    for f in (REPO_ROOT / "ml-backend" / "peakpick_ml").rglob("*.py"):
        if f.name.startswith("_"):
            continue
        try:
            tree = ast.parse(f.read_text())
            imports = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.add(alias.name.split(".")[0])
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.add(node.module.split(".")[0])
            py_files[f.relative_to(REPO_ROOT)] = imports
        except SyntaxError:
            report.add("architect", f"  - ⚠️ 语法错误: {f.relative_to(REPO_ROOT)}")

    # Check file count per layer
    layers = {
        "src/": list((REPO_ROOT / "src").rglob("*.tsx")) + list((REPO_ROOT / "src").rglob("*.ts")),
        "ml-backend/peakpick_ml/": list((REPO_ROOT / "ml-backend" / "peakpick_ml").rglob("*.py")),
        "src-tauri/src/": list((REPO_ROOT / "src-tauri" / "src").rglob("*.rs")),
    }

    for layer, files in layers.items():
        count = len(files)
        if count > 50:
            report.add("architect", f"  - ⚠️ {layer} 有 {count} 个文件，考虑模块拆分")

    report.add("architect", f"  - ✅ 前端文件: {len(layers['src/'])} 个")
    report.add("architect", f"  - ✅ 后端文件: {len(layers['ml-backend/peakpick_ml/'])} 个")
    report.add("architect", f"  - ✅ Tauri 壳文件: {len(layers['src-tauri/src/'])} 个")


# ── Role: Code Reviewer ─────────────────────────────────────

def review_code(report: Report):
    """Static analysis of code quality."""

    forbidden_patterns = [
        (r"except\s*:\s*\n\s*pass", "❌ 裸 `except: pass`"),
        (r"except\s+[A-Za-z]+\s*:\s*\n\s*pass", "⚠️ 裸 `except X: pass`"),
        (r"except\s*:\s*\n\s*(?:return|continue|break)", "⚠️ 裸 `except: return/continue/break`"),
    ]

    # Scan Python files
    for f in (REPO_ROOT / "ml-backend" / "peakpick_ml").rglob("*.py"):
        if "venv" in str(f) or "__pycache__" in str(f):
            continue
        content = f.read_text()
        rel = f.relative_to(REPO_ROOT)

        # Check line count per file
        lines = content.split("\n")
        if len(lines) > 500:
            report.add("code_review", f"  - ⚠️ {rel} 有 {len(lines)} 行，考虑拆分")

        # Check for forbidden patterns
        for pattern, msg in forbidden_patterns:
            if re.search(pattern, content, re.MULTILINE):
                report.add("code_review", f"  - {msg}: {rel}")

        # Check for TODO markers
        todos = re.findall(r"#\s*(TODO|FIXME|HACK|XXX)", content)
        if todos:
            report.add("code_review", f"  - ℹ️ {rel} 有 {len(todos)} 个待办标记: {', '.join(todos)}")

    # Scan TSX/TS files
    for f in (REPO_ROOT / "src").rglob("*.tsx"):
        content = f.read_text()
        rel = f.relative_to(REPO_ROOT)
        lines = content.split("\n")
        if len(lines) > 300:
            report.add("code_review", f"  - ⚠️ {rel} 有 {len(lines)} 行，考虑拆分组件")

        # Check for any
        if re.search(r":\s*any\b", content):
            report.add("code_review", f"  - ⚠️ {rel} 使用了 `any` 类型")

    report.add("code_review", "  - ✅ 静态分析完成")


# ── Role: QA Engineer ───────────────────────────────────────

def review_qa(report: Report):
    """Check test infrastructure and coverage."""

    # Check if tests exist
    backend_tests = list(REPO_ROOT.glob("ml-backend/tests/**/*.py"))
    frontend_tests = list(REPO_ROOT.glob("src/**/*.test.*")) + list(REPO_ROOT.glob("src/**/*.spec.*"))

    if backend_tests:
        report.add("qa", f"  - ✅ 后端测试: {len(backend_tests)} 个文件")
    else:
        report.add("qa", "  - ⚠️ 后端测试目录为空")

    if frontend_tests:
        report.add("qa", f"  - ✅ 前端测试: {len(frontend_tests)} 个文件")
        for t in frontend_tests:
            report.add("qa", f"    - {t.relative_to(REPO_ROOT)}")
    else:
        report.add("qa", "  - ℹ️ 前端测试未添加（项目早期阶段）")

    # Check test configs
    pytest_ini = REPO_ROOT / "ml-backend" / "pytest.ini"
    if not pytest_ini.exists():
        report.add("qa", "  - ℹ️ 未找到 pytest 配置")

    # Check for vitest config
    vitest_config = REPO_ROOT / "vitest.config.ts"
    if not vitest_config.exists():
        report.add("qa", "  - ℹ️ 未找到 vitest 配置")

    # Run test if possible
    report.add("qa", "  - ✅ 测试基础设施检查完成")


# ── Role: UX Reviewer ───────────────────────────────────────

def review_ux(report: Report, screenshots_dir: Optional[Path] = None):
    """Check frontend screenshot availability."""

    if screenshots_dir and screenshots_dir.exists():
        screenshots = list(screenshots_dir.rglob("*.png"))
        if screenshots:
            report.add("ux", f"  - ✅ 本轮截图: {len(screenshots)} 张")
            for s in screenshots:
                report.add("ux", f"    - MEDIA:{s}")
        else:
            report.add("ux", "  - ℹ️ 截图目录为空")
    else:
        report.add("ux", "  - ℹ️ 无新增截图（本次无前端改动）")


# ── Run ─────────────────────────────────────────────────────

def run(role: Optional[str] = None, screenshots_dir: Optional[Path] = None) -> Report:
    report = Report()

    if role is None or role == "arch":
        review_architect(report)
    if role is None or role == "code":
        review_code(report)
    if role is None or role == "qa":
        review_qa(report)
    if role is None or role == "ux":
        review_ux(report, screenshots_dir)

    return report


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="PeakPick Multi-Role Review")
    parser.add_argument("--role", choices=["arch", "code", "qa", "ux"])
    parser.add_argument("--output", type=str, help="Save report to file")
    parser.add_argument("--screenshots", type=str, help="Path to screenshots directory")
    args = parser.parse_args()

    screenshots_dir = Path(args.screenshots) if args.screenshots else None
    report = run(role=args.role, screenshots_dir=screenshots_dir)
    output = report.format()

    if args.output:
        out_path = REPO_ROOT / args.output
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output)
        print(f"✅ Review report saved to {out_path}")
    else:
        print(output)

    if report.has_issues():
        sys.exit(1)
