# bb-browser 安装与使用指南

本文档基于 thimper/bb-browser fork，包含上游未合并的 async eval 修复。

## 架构

bb-browser 有两条连接路径：

```
Path A: CLI 直连（默认）
  bb-browser site xxx → 启动新 Chrome 实例 → CDP WebSocket 直连
  - 新 Chrome 无登录态，需重新登录
  - 不需要扩展

Path B: Daemon + Extension（MCP 模式）
  bb-browser --mcp → daemon(19824) → SSE → Chrome Extension → 真实 Chrome
  - 复用用户已登录的浏览器
  - 需要安装 Chrome 扩展
  - Chrome 页面会显示调试提示条（chrome.debugger 限制）
```

## 安装步骤

### 1. 安装 bb-browser CLI

```bash
npm install -g bb-browser
```

### 2. 安装适配器（bb-sites）

使用上游版本：
```bash
bb-browser site update
```

或使用 thimper fork（含 twitter/search 动态 module ID 修复）：
```bash
git clone https://github.com/thimper/bb-sites.git
ln -sf $(pwd)/bb-sites ~/.bb-browser/bb-sites
```

### 3. 安装 Chrome 扩展（仅 MCP/daemon 模式需要）

```bash
# 下载扩展
gh release download --repo epiral/bb-browser --pattern "*.zip" --dir /tmp/bb-ext
unzip /tmp/bb-ext/*.zip -d ~/bb-browser-extension

# 应用 async eval 修复（上游未合并前需要）
# 编辑 ~/bb-browser-extension/background.js：
#   1. 删除 evaluate 函数中的 replMode: true
#   2. 将 return result.result?.value; 改为 return result.result?.value ?? result.result;
#   （共两处，evaluate 和 callFunctionOn 各一处）
```

在 Chrome 中加载：
1. 打开 `chrome://extensions/`
2. 开启开发者模式
3. 加载已解压的扩展 → 选择 `~/bb-browser-extension` 目录
4. **注意：扩展必须安装在你要使用的 Chrome profile 中**

### 4. 构建 daemon（MCP 模式需要）

```bash
git clone https://github.com/thimper/bb-browser.git
cd bb-browser
npm install

# 构建 shared + daemon
cd packages/shared && npx pnpm run build && cd ..
cd packages/daemon && npx pnpm run build && cd ..
```

## 使用方式

### CLI 模式（简单，但用新 Chrome 实例）

```bash
bb-browser site twitter/search "AI"
bb-browser site zhihu/hot
bb-browser site github/repo epiral/bb-browser
```

首次使用会启动一个空的 Chrome 实例，需要在里面登录目标网站。

### MCP 模式（用你的真实 Chrome）

#### 手动启动

```bash
# 1. 打开你的 Chrome（确保扩展已安装在对应 profile）
open -a "Google Chrome" --args --profile-directory=Default

# 2. 启动 daemon（必须用 127.0.0.1，macOS 的 localhost 可能解析为 IPv6）
node ~/bb-browser/packages/daemon/dist/index.js --host 127.0.0.1 &

# 3. 验证
curl -s http://127.0.0.1:19824/status
# 期望: {"extensionConnected":true}
```

#### Claude Code MCP 配置

在 Claude Code settings 中添加：

```json
{
  "mcpServers": {
    "bb-browser": {
      "command": "npx",
      "args": ["-y", "bb-browser", "--mcp"]
    }
  }
}
```

配置后重启 Claude Code 生效。

## 注意事项

- **daemon 绑定地址**：macOS 上必须 `--host 127.0.0.1`，否则扩展连不上（IPv6 问题）
- **多 Chrome profile**：扩展只能看到所安装 profile 的 tabs，确保安装在正确的 profile
- **daemon 单连接**：一次只支持一个扩展连接，多 profile 同时运行会互踢
- **调试提示条**：使用扩展时页面顶部会显示 "正在调试此标签页"，这是 Chrome 的安全提示，无法关闭
- **CLI vs MCP**：CLI 模式不走 daemon，直连 managed Chrome；MCP 模式走 daemon+扩展

## 已知上游 bug（已在 fork 修复）

- **async eval 返回空对象**：`cdp-service.ts` 的 `replMode: true` 导致 async 函数返回值丢失（PR: epiral/bb-browser#128）
- **twitter/search webpack ID 硬编码**：x.com 改版后失效（PR: epiral/bb-sites#45）
