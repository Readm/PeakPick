# Cycle 004 — Tauri 原生集成

## 目标
添加 Tauri 原生能力：文件夹选择对话框、Python 后端进程管理、图片文件读取展示。实现完整的桌面应用体验。

## 任务列表

### 1. Tauri 插件安装
- [ ] `tauri-plugin-dialog` — 原生文件夹选择器
- [ ] `tauri-plugin-fs` — 读取文件系统
- [ ] `tauri-plugin-shell` — 管理 Python 后端进程

### 2. Rust 命令 (lib.rs)
- [ ] `select_folder()` — 打开原生对话框选择文件夹
- [ ] `read_image_as_base64(path)` — 读取图片，返回 base64 data URL
- [ ] `start_backend()` — 启动 Python 后端进程
- [ ] `stop_backend()` — 停止 Python 后端进程
- [ ] `get_backend_status()` — 返回进程运行状态
- [ ] `get_app_data_dir()` — 返回平台数据目录

### 3. Tauri 配置更新
- [ ] Cargo.toml — 添加插件依赖
- [ ] capabilities/default.json — 添加插件权限
- [ ] tauri.conf.json — 窗口标题/尺寸

### 4. 前端桥接 (src/tauri.ts)
- [ ] `isTauri: boolean` — 检测是否在 Tauri 环境
- [ ] `selectFolder(): Promise<string | null>` — 调用文件夹选择
- [ ] `readImage(path): Promise<string | null>` — 调用图片读取
- [ ] `startBackend(): Promise<boolean>` — 启动后端
- [ ] `stopBackend(): Promise<void>` — 停止后端

### 5. 组件更新
- [ ] ImportOverlay — 使用 Tauri 文件选择器
- [ ] PhotoCard — 使用 Tauri 读取真实图片
- [ ] DetailOverlay — 使用 Tauri 读取大图
- [ ] App.tsx — 启动时自动启动后端

### 6. 测试
- [ ] 前端桥接模块测试
- [ ] Rust 命令通过 `tauri build` 验证

## 交付物
- 可运行的 Tauri 桌面应用（原生窗口）
- 文件夹选择对话框打开图片目录
- 真实图片在 grid 和 detail 中显示
- Python 后端自动启动/停止
