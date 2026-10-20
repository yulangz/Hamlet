# 开发与验证

## 从源码运行检查

在仓库根目录执行：

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install --with-deps chromium
corepack pnpm check
```

`check` 顺序执行 TypeScript 类型检查、生产构建、Node.js 核心与集成测试、Python 测试、Chromium 页面测试。浏览器与系统依赖仅需在首次使用或版本更新时安装。

日常修改可单独运行 `corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm test:python`、`corepack pnpm test:ui`。涉及 CLI、MCP 或浏览器测试时，先运行 `corepack pnpm build`，以验证生成的入口。

## 测试覆盖

| 测试文件                    | 覆盖内容                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `tests/core.test.ts`        | 身份与权限、模板和快照、fork/resident、FIFO 与 direct 目录串行、去重、Git/non-Git 工作目录及合并 |
| `tests/integration.test.ts` | HTTP/SSE、认证、真实 CLI 子进程、Codex/Claude harness 契约、MCP stdio 与工具权限、doorbell 脚本  |
| `tests/lifecycle.test.ts`   | 并发启动、宿主退出后 daemon 存活、硬崩溃恢复、遗留子进程和脚本恢复                               |
| `tests/observation.test.ts` | 排队原因、消息来源、Owner 查询及分页、历史快照、旧库迁移和损坏日志尾行                           |
| `tests/branding.test.ts`    | Hamlet 命名、新旧 CLI/环境变量/数据目录/工作目录标记及认证兼容                                   |
| `tests/doorbell_test.py`    | Python ring 请求、持久状态与定时入口                                                             |
| `tests/ui*.e2e.ts`          | Chromium 页面中的配置、脚本、实例历史、diff/merge、消息重试、执行语义与阻塞原因                  |

常规测试使用受控 harness 或本地 CLI fixture，不调用付费模型。测试使用临时状态目录，不应指向自己的运行数据库。

## 可选的真实 Codex 验证

```bash
node scripts/smoke-codex.mjs
```

需要本机已安装并登录 Codex，会消耗模型额度。此脚本在临时目录验证新会话、注入的 `whoami` MCP 工具、上下文 resume，并在退出时关闭测试 daemon。它不属于常规 `check`。

Claude 的常规测试验证 CLI 参数、事件与调度契约；真实模型调用需另行在已登录的目标环境验证。Linux 是当前自动验证平台；macOS 的 APFS clone 与 launchd 分支需在目标机器验证。

## 仓库文件保留规则

- 提交 `packages/` 源码与包配置、`bin/` 可执行入口、`scripts/`、`tests/` 及 fixture、README 和开发文档、工作区配置与 `pnpm-lock.yaml`。
- 保留可执行文件的 Git 权限；保留 `bin/detached.js` 等兼容入口，以支持已有接入。
- `node_modules/`、各包 `dist/`、测试报告、截图、Python 缓存等由工具生成，留在本地并由 `.gitignore` 排除。
- 数据目录、SQLite 数据库、运行历史、日志、令牌及项目本地 MCP 配置不入库。更换代码路径时，保持 `HAMLET_HOME` 一致，运行数据与源码目录独立。
- 设计文档及本地部署复盘不随源码发布；需要保留时放在仓库外。不要使用 `git add -f` 绕过这些规则。

发布前用 `git status --short`、`git diff --cached --stat` 和 `git ls-files --stage` 核对提交内容与入口文件权限。克隆后安装依赖并重新构建即可生成运行入口。
