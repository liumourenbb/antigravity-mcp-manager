# Antigravity MCP Manager 🚀

[![Windows 11](https://img.shields.io/badge/Windows-11%20Fluent%202-0078d4?style=flat&logo=windows)](https://github.com/liumourenbb/antigravity-mcp-manager)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=flat&logo=node.js)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-44.4.5-47848F?style=flat&logo=electron)](https://www.electronjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

专为 **Google Antigravity** 与通用 AI Agent 打造的现代化、跨项目 MCP（Model Context Protocol）全生命周期桌面管理套件。

支持在 Windows 11 桌面端以原生亚克力（Acrylic）与 Fluent 2 视觉体系直观管理、测试、探查、克隆与迁移全局及工程工作区专有 MCP 服务。

---

## ✨ 核心特性

- 🖥️ **Windows 11 Fluent 2 / Acrylic 桌面设计**
  - 深度毛玻璃背景（Backdrop Blur）、暗黑黑曜石代码容器、顶部光感发光线与流线型胶囊标签。
  - 原生支持 Windows 11 标题栏拖拽与控制，提供极具沉浸感的高级桌面质感。

- 🌐 **全局 (Global) 与项目工作区 (Workspace) 双域隔离**
  - **全局服务**：统一存放于 `~/.gemini/config/mcp_config.json`，所有 Antigravity 窗口默认继承。
  - **项目专属 MCP**：精准对齐项目本地 `.agents/mcp_config.json`，工程间完全物理隔离，避免工具污染。
  - **零成本平滑迁移**：在编辑界面即可一键跨作用域迁移配置，自动清洗旧配置文件。

- 📋 **多格式智能剪贴板导入 (Clipboard Paste Engine)**
  - 支持快捷键 `Ctrl+V` 一键自动从系统剪贴板导入配置。
  - 智能策略解析器自适应四种主流 MCP 格式：
    1. 根对象包裹：`{ "mcpServers": { ... } }`
    2. 单键值对对象：`{ "git": { "command": "uvx", ... } }`
    3. 纯配置对象：`{ "command": "npx", "args": [...] }`（自动推导命名）
    4. 宽松 JSONC：自动清洗单行/多行注释与末尾逗号。

- ⚡ **毫秒级连接诊断与 Schema 实时探查**
  - 原生集成 Stdio（基于 JSON-RPC 2.0 initialize 握手）与 HTTP 协议端到端探测。
  - 一键探查服务端缓存的可用 Tools、入参 JSON Schema 及调用规范。

- 🧹 **JetBrains IDE 伴随 Bridge 诊断与清理**
  - 智能感知 IntelliJ IDEA、WebStorm 等 IDE 重启后残留的失效桥接脚本，支持一键清扫释放端口。

- 🔄 **自动快照与零风险版本回滚**
  - 在每次编辑、覆盖、删除或迁移配置时均自动生成版本快照。
  - 支持历史版本对比与秒级配置一键还原。

- 📐 **严格遵守 Rule 7 架构防膨胀红线**
  - 单方法代码行数严格控制在 **80 行红线**以内。
  - 彻底拆分原本的单一“上帝页面”，建立 8 个职责分明的独立前端核心模块。

---

## 🚀 快速开始

### 方式一：运行 Windows 11 原生桌面端 (推荐)

项目内提供打包脚本与一键快捷启动器：

```bash
# 启动开发桌面窗口
npm run desktop

# 或在项目根目录下双击 windows11.exe 启动
./windows11.exe
```

### 方式二：本地 Web 服务模式

```bash
# 安装依赖
npm install

# 启动本地 Web 管理控制台
npm start
# 浏览器访问 http://localhost:3000
```

### 方式三：打包构建独立可执行程序

```bash
# 一键生成完整 Windows 11 执行程序包 (无需外网下载)
npm run build:win
```
构建产物输出于：
- `dist/windows11/windows11.exe`（完整独立发行版）
- `windows11.exe`（根目录原生极速启动器）

---

## 📂 项目结构

```
antigravity-mcp-manager/
├── bin/
│   └── cli.js                     # 命令行 CLI 入口
├── src/
│   ├── core/                      # 核心业务引擎
│   │   ├── backup.js              # 快照与备份模块
│   │   ├── config.js              # 全局与工作区配置 CRUD & 迁移引擎
│   │   ├── diagnostics.js         # Stdio & HTTP 握手诊断
│   │   ├── jetbrains.js           # JetBrains 桥接清理引擎
│   │   ├── paths.js               # 跨平台路径解析中心
│   │   ├── presets.js             # 常用 MCP 官方模板库
│   │   ├── tools.js               # Tool Schema 探查
│   │   └── workspaces.js          # Antigravity 工程项目发现与同步
│   ├── desktop/                   # Electron 原生桌面集成
│   │   ├── ipc.js                 # 领域隔离 IPC 通信调度中心
│   │   ├── main.js                # 主进程入口
│   │   └── preload.cjs            # 安全上下文桥接
│   ├── web/                       # 前端渲染层 (Fluent 2)
│   │   ├── js/                    # 模块化前端架构 (Rule 7 规范)
│   │   │   ├── api.js             # 统一数据请求客户端
│   │   │   ├── app.js             # 顶层生命周期与过滤调度
│   │   │   ├── diagnostics-presets.js # 预设与诊断管理
│   │   │   ├── helpers.js         # 通用基础工具
│   │   │   ├── paste-import-manager.js # 剪贴板解析与导入
│   │   │   ├── server-card-renderer.js # 服务卡片渲染与悬浮交互
│   │   │   ├── server-form-manager.js  # 表单编辑维护
│   │   │   └── workspace-manager.js    # 项目工作空间联动
│   │   └── index.html             # 结构清晰的 UI 视图骨架
│   └── server.js                  # 轻量 HTTP 备用服务
├── scripts/
│   └── build_windows11.js         # 离线韧性构建脚本
└── test/                          # 自动化测试套件
```

---

## 📜 许可证

[MIT License](LICENSE) © 2026 Antigravity Pair
