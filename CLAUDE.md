# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

基于 Tauri 2.0 的 UPX 可视化加壳/脱壳工具，Windows 平台专用。

### 技术栈
- **前端**：原生 HTML + TailwindCSS + JavaScript（ui/ 目录）
- **后端**：Rust + Tauri 2.0（src-tauri/ 目录）
- **核心**：UPX 可执行文件（upx/upx.exe）

### 应用架构
- **单窗口应用**：自定义标题栏（无边框窗口 `decorations: false`）
- **拖放支持**：支持文件/文件夹拖放到窗口，自动判断操作区域
- **多线程批处理**：根据 CPU 核心数动态调整并发数
- **配置持久化**：配置保存在程序目录的 `upx_gui_config.json`

## 常用命令

```bash
# 开发模式运行（热重载）
cargo tauri dev

# 编译发行版
cargo tauri build

# 编译产物位置
# src-tauri/target/release/bundle/
# 生成 MSI 和 NSIS 两种安装包
```

## 代码结构

### 前端 (ui/)
- `index.html` - 主界面，包含双操作按钮布局
- `js/main.js` - 前端逻辑，约 740 行，包含：
  - 拖放检测与区域判断
  - 动态批处理（基于 CPU 核心数）
  - 配置的保存/加载
  - 日志系统（带数量限制和自动清理）
- `css/style.css` - 主样式
- `css/tailwind-custom.css` - Tailwind 自定义

### 后端 (src-tauri/src/)
- `main.rs` - 唯一的 Rust 源文件，约 500 行，包含所有 Tauri commands：
  - `process_upx` - 执行压缩/解压
  - `scan_folder` - 递归扫描 exe/dll 文件
  - `get_upx_version` - 获取 UPX 版本
  - `refresh_icon_cache` - 刷新 Windows 图标缓存
  - `save_config` / `load_config` - 配置持久化

## 重要细节

### UPX 路径解析
开发环境：`../upx/upx.exe`
打包后：`_up_/upx/upx.exe`（相对于程序目录）

### 编码处理
UPX 在 Windows 上输出 GBK 编码，使用 `encoding_rs::GBK` 转换为 UTF-8

### 批处理并发策略
```javascript
batchSize = Math.max(2, Math.min(cpuCores * 2, 16))
```
最小 2，最大 16，默认为 CPU 核心数的 2 倍

### Tauri 2.0 特性
- 使用 `window.__TAURI__` 全局对象（需启用 `withGlobalTauri: true`）
- 命令调用：`invoke('command_name', { options })`
- 拖放事件：`listen('tauri://drag-drop', handler)`
