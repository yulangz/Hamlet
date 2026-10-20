# Hamlet · 坊

> Hamlet — a quiet village of detached agents, woken by a doorbell.

**一座 Agent 各自做事、有事敲门的小村落。**

Hamlet 是英语里的“小村落”。中文名“坊”取自唐代长安的里坊：城中街区各有坊墙，彼此独立；“坊”也有作坊的意思，是做事的地方。

在 Hamlet 里，每个 **group 是一座坊**。坊内的 Agent 各自独立干活，有事敲门（`doorbell`）唤醒，彼此串门（`message_to`）协作，但不越过坊墙。坊墙对应工具权限与通信边界，文件系统与工作目录由使用者安排。

Hamlet 为支持 MCP 的宿主提供单机后台 Agent 执行能力。独立 daemon 负责持久化消息、拉起运行、维护权限与记录；宿主会话结束，坊里的工作仍可继续。当前支持 Codex 与 Claude Code，并附带 CLI、Web UI 和 Python doorbell 库。

## 几个简单约定

- **各自做事**：每个实例有自己的会话，可选独立 worktree。`fork` 每次新建实例，`resident` 保留上下文。
- **敲门才醒**：所有触发先进入持久化消息队列。`message_to` 异步返回，每条消息会触发一个执行回合。
- **坊内串门**：Worker 与 Administrator 只在本坊查询和通信；Owner 可以管理和观察各坊。
- **看得见等待**：同一实例按 FIFO 执行，共用 direct 目录全局串行；接口和 UI 明确说明排队原因。
- **自行组织**：任务拆分、交接、版本、验收与截止控制由 Agent、调用方和 doorbell 约定。

## 安装与启动

需要 Node.js 20+、Git、Python 3.9+。使用 Codex 时需安装并登录 `codex`；Claude 适配器需安装并登录 `claude`。构建无需模型凭据。

```bash
git clone git@github.com:yulangz/Hamlet.git
cd Hamlet
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm build
node bin/hamlet.js start
node bin/hamlet.js ui --open
```

全新安装的状态目录为 `~/.hamlet/`。升级时若仅有旧 `~/.detached/`，会继续复用该目录。设置 `HAMLET_HOME=/absolute/path` 可使用独立数据目录。daemon 只监听 `127.0.0.1`，端口自动选择并写入 `daemon.json`。`start` 和宿主 MCP 都会自动发现或启动 daemon；PID 锁保证只启动一份。

可把仓库的 `bin/` 和 `packages/py-doorbell/bin/` 加入 `PATH`，之后直接使用 `hamlet`、`doorbell ring` 和 `doorbell-python`。下面示例使用仓库内的入口，不依赖全局安装。

```bash
node bin/hamlet.js status
node bin/hamlet.js stop
node bin/hamlet.js install-service    # 可选：systemd 用户服务或 launchd
node bin/hamlet.js uninstall-service
```

## 宿主 MCP 配置

把下面配置中的路径替换为本仓库的绝对路径。stdio 的 stdout 只输出 MCP 协议。

只在一个 Codex 项目使用时，写入该项目的 `.codex/config.toml`；Codex 需信任该项目才能加载。所有项目都要使用时，再写入用户级 `~/.codex/config.toml`：

```toml
[mcp_servers.hamlet]
command = "node"
args = ["/absolute/path/Hamlet/packages/mcp-host/dist/index.js"]
```

Claude Code / 其他 MCP 宿主的等价 JSON：

```json
{
  "mcpServers": {
    "hamlet": {
      "command": "node",
      "args": ["/absolute/path/Hamlet/packages/mcp-host/dist/index.js"]
    }
  }
}
```

宿主工具包括 group 管理、逻辑 Agent 管理、实例查询与归档、换新常驻实例、终止运行、异步 `message_to`、消息/运行/事件查询、doorbell 控制和日志、`ui_open`。子 Agent 的 MCP 由适配器通过当前进程的配置覆盖注入，无需安装插件，也不修改全局 Codex 配置。Worker 仅能看到 `whoami`、`group_agents`、`instance_get`、`message_to`；Administrator 额外获得本组 Worker 的管理工具。daemon 对每次调用重新判定身份和权限。

## 建一座坊，开始一次运行

```bash
node bin/hamlet.js call group_create '{"name":"开发坊"}'
# 使用上一步返回的 group ID
node bin/hamlet.js call agent_create '{"group":"g-xxxx","role_name":"实现者","workdir":"/tmp/hamlet-project","run_mode":"resident","prompt_tpl":"处理任务 {{task}}"}'
# 使用返回的逻辑 Agent 短 ID
node bin/doorbell.js ring abcdef --var task=实现功能 --dedup-key task-1
node bin/doorbell.js ring abcdef-1 --prompt '补充测试'
node bin/hamlet.js call instance_get '{"id":"abcdef-1"}'
```

也可用 `--group g-xxxx` 按角色名寻址，或用 `角色名#序号` 寻址实例。`--system-prompt` 只在新会话生效；resume 会记录忽略警告。`--dedup-window 7d` 覆盖默认 24 小时去重窗口；不传 `dedup-key` 时不去重。`message_to` 返回入队记录，不等待目标运行。

创建/查询 Agent 时返回的 `execution` 会说明实际并发约束；UI 的“配置 → 执行语义”也会显示共用 direct 目录的其他 Agent。**入队成功不表示已经运行。** `message_to` 和 ring 的返回值中，`queue_reason` 解释当前为什么等待，`next_action` 指明预期 fork/resume；这些都是读取当时的状态，之后可用 `message_get` 更新。

| `queue_reason.code`  | 含义                                                      |
| -------------------- | --------------------------------------------------------- |
| `workdir_busy`       | 同一 direct 目录被其他回合占用；含路径、阻塞实例与 run ID |
| `instance_busy`      | 同一实例的上一回合还在执行；含阻塞 run ID                 |
| `group_paused`       | Group 暂停，保留消息而不调度                              |
| `fifo`               | 同一执行队列还有更早的消息；含前序消息 ID                 |
| `awaiting_dispatch`  | 可以调度，正在等待调度器启动回合                          |
| `target_unavailable` | 目标失效；调度器处理后会在消息上记录失败                  |

消息一旦 dispatched 或结束，`queue_reason` 为 null。查询不会推动队列或唤醒 Agent。共用 direct 目录的 Agent 不应在本轮等待对方 ACK，因为对方必须等当前回合结束才有机会运行。

逻辑 Agent 创建后不会运行。fork 模式每条逻辑目标消息新建实例；resident 模式首次创建即登记常驻实例，后续消息按 FIFO resume。长 ID 始终表示续跑指定实例。不同实例并行执行；相同真实路径的 direct 工作目录全局串行。失败不阻塞后续消息，结束不自动通知发送者。

## Owner 查询与复盘

外部 MCP 正式提供五个只读工具；内置 Worker/Administrator 的工具列表不增加这些 Owner 工具。

| 工具              | 用途                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `message_list`    | 按 group、logical_id、instance_id、target、source、from_id、status、since/until 筛选消息，并查看当前排队原因   |
| `message_get(id)` | 单条消息及其所有运行尝试，包括失败后重试的旧运行                                                               |
| `run_list`        | 按 group、logical_id、instance_id、message_id、source、from_id、status、since/until 查询历史、结果、用量和耗时 |
| `run_get(id)`     | 查询一次运行的实际 prompt、结果、触发快照和 `queue_wait_ms`                                                    |
| `run_events(id)`  | 分页读取标准化事件，含命令、工具、警告和错误                                                                   |

列表仍返回数组。MCP 查询默认 `limit=100`，最大 500；使用 `offset` 翻页，`order=asc/desc` 按持久化顺序排列。消息的时间筛选针对 `created_at`，运行的时间筛选针对 `started_at`。既有 HTTP `message_list` 在不传分页参数时继续返回完整列表；`run_events` 的无分页 HTTP 形式也保留，供 UI 读取完整历史。

```bash
node bin/hamlet.js call message_list '{"group":"g-xxxx","status":"queued","limit":100}'
node bin/hamlet.js call message_get '{"id":"消息ID"}'
node bin/hamlet.js call run_list '{"group":"g-xxxx","order":"desc","limit":20}'
node bin/hamlet.js call run_get '{"id":"运行ID"}'
node bin/hamlet.js call run_events '{"id":"运行ID","limit":100,"offset":0}'
```

`sender` 区分认证身份和调用入口：Owner 的 `message_to` 显示为“宿主调用方 (owner)”，UI 显示“Web UI (owner)”，普通 ring 显示“ring 调用方 (owner)”；Agent 消息保留实例角色与长 ID，脚本使用受限令牌时保持 `doorbell_script` / `doorbell: 角色名`。**Owner 凭据不能证明是用户本人手动输入**，也不能凭它推断脚本名称。需要准确标识自动监听或定时触发时，使用该 Agent 的 doorbell。

升级不改写旧消息的 `from_role` 或旧运行的实际 prompt；查询另提供 `sender` 解释已记录的来源。新运行保存 `trigger_snapshot` 和每次尝试的排队时长，重试不覆盖旧 run。旧 run 没有快照时，`trigger_is_snapshot=false` 且 `queue_wait_ms=null`，不能据此声称恢复了当时未保存的数据。Owner 仍可查询软删除 Agent 的运行与事件；消息筛选不会因目标已删除而混入别的 group。

插件只提供运行与通信事实。任务编号、版本、ACK、`complete`、`FINAL_PASS`、截止时间和收尾协议均属于 Agent、调用方或 doorbell 的约定。

## 工作目录

默认开启 worktree，空目录自动初始化 Git，形成 `main/`、`worktrees/`、`shared/` 和 `.hamlet/workdir.json`。非空目录首次使用会返回 `needs_migration` 和摘要，不移动任何文件；传 `migrate:true` 才把原内容完整移入 `main/`。UI 会展示摘要并请求确认。传 `worktree:false` 则直接使用原目录，不迁移。

- Git 模式从 main 的 HEAD 或 `base_ref` 创建分支 `agent/<实例ID>`；main 未提交修改不会带入，运行事件中有警告。每次运行结束自动提交。UI 可查看 diff、合并以及归档后删除保留分支；冲突保留在 main 中供手动解决。
- 非 Git 模式用 `base/` 快照和写时复制创建实例。每个实例另存 fork 时的基准（`.hamlet/bases/<实例ID>/`），刷新 base 只影响之后的 fork。UI 可选择文件应用到 main，若 main 也已改动，必须确认覆盖。
- 归档会清理 worktree，Git 分支保留；非 Git 的实例副本和实例基准会删除。harness 的会话文件不清理。

编辑逻辑配置只影响之后的 fork，已有实例的模型、参数、环境和模板均沿用配置快照。常驻实例要应用新配置时，使用“换新常驻实例”。

## 敲门：自定义 doorbell

在 Agent 的 Doorbell 页面编辑并保存脚本，或创建 Agent 时指定可执行脚本的绝对路径。保存会自动重启。daemon 注入 `DOORBELL_AGENT_ID`、`DOORBELL_GROUP_ID`、`DOORBELL_URL`、`DOORBELL_TOKEN`、`DOORBELL_STATE_DIR`，并把自带解释器包装和 CLI 加入 PATH。

```python
#!/usr/bin/env doorbell-python
from doorbell import ring, state, every

@every(seconds=60)
def check():
    # 替换为你的 API / 文件轮询
    next_id = state.get("last_id", 0) + 1
    ring(prompt=f"处理事件 {next_id}", dedup_key=f"event-{next_id}")
    state.set("last_id", next_id)
```

`every` 在脚本顶层完成后开始循环；异常会让脚本退出，交由 daemon 指数退避重启。`state` 用文件锁和原子替换持久化 JSON。`ring` 仅用 Python 标准库发送认证 HTTP 请求。提供[轮询模板](packages/py-doorbell/templates/poll.py)与[监听模板](packages/py-doorbell/templates/listen.py)。也可 `python3 -m pip install ./packages/py-doorbell`，在自己的解释器中导入 `doorbell`。

stdout/stderr 写入 `doorbells/<短ID>/output.log`，UI 实时查看。崩溃重启从 1 秒退避到最多 60 秒；10 分钟内第 6 次崩溃标记 failed，人工启动/重启可复位。停 daemon 保留 enabled 状态，下次启动恢复脚本。脚本令牌只能 ring 所属逻辑 Agent 及其实例。

## HTTP 与状态

认证：`Authorization: Bearer <token>`。本机 Owner 凭据由权限为 600 的 `secret` 派生，CLI/MCP 自动读取。UI 使用带随机密钥签发令牌的首次访问 URL，随即换成 HttpOnly / SameSite=Strict cookie 并清除 URL 查询参数。拒绝跨源请求和非本机 Host。身份权限作用于工具层；不做文件系统隔离。

- `POST /api/ring`：`target`、`group?`、`prompt?`、`system_prompt?`、`vars?`、`dedup_key?`、`dedup_window?`。
- `POST /api/tools/<工具名>`：JSON 参数。UI 的扩展操作还包括 `group_update`、`state`、`message_list/retry/cancel`、`run_events`、`doorbell_script_get/save`、`instance_diff/merge`、`workdir_refresh`、`branch_delete`、`instance_fork`。
- `GET /api/events`：SSE `ready`、`change`、`agent` 事件；实例事件按身份过滤。
- `GET /health`：无凭据的进程健康状态；不包含业务数据。
- `POST /api/shutdown`：仅 Owner。

SQLite 使用 WAL。标准化事件在 `runs/<run_id>.jsonl`，原始事件在同目录的 `.raw.jsonl`。重启后运行中的记录标记 interrupted，触发消息标记 failed，不自动重放；queued 消息继续调度。已知遗留子进程在核对运行标记/令牌后终止，再恢复调度。

## 从 Detached 升级

从 0.1.2 起，英文名统一为 **Hamlet**，中文名为 **坊**。新的 CLI 是 `hamlet`，MCP 配置键是 `hamlet`，工作区包名使用 `@hamlet/*`，Python 发行包名为 `hamlet-doorbell`；Python 导入名仍是 `doorbell`。

- 旧 `detached` 命令和 `bin/detached.js` 保留为别名，指向同一服务。
- `HAMLET_HOME`、`HAMLET_URL`、`HAMLET_TOKEN`、`HAMLET_CODEX_BIN`、`HAMLET_CLAUDE_BIN` 为主要环境变量，对应的 `DETACHED_*` 仍可使用；同时设置时以 `HAMLET_*` 为准。
- 升级不搬动数据库、日志、Git 分支或已有工作目录。旧数据目录 `~/.detached/` 和旧工作目录标记 `.detached/workdir.json` 继续被识别；新工作目录使用 `.hamlet/`。
- 已有 MCP 配置可把 `[mcp_servers.detached]` 和对应的 `.env` 表改为 `[mcp_servers.hamlet]`，保留原启动路径，并把 `DETACHED_HOME` 改为 `HAMLET_HOME`，值保持原数据目录。移除旧表，避免重复加载；之后重连 MCP 或新开宿主会话。原配置名也能继续连接新版 server。
- 新安装的用户服务名为 `hamlet.service`（Linux）或 `local.hamlet`（macOS）。若曾安装旧用户服务，可先用 `hamlet uninstall-service` 移除旧服务，再用 `hamlet install-service` 安装新名称。

所有命令和宿主应指向同一个数据目录；若显式指定 `HAMLET_HOME`，请在 CLI 与 MCP 的 `env` 中保持一致。`doorbell`、`message_to`、group ID、实例 ID 和 HTTP API 路径保持原有含义。

## 验证

[开发与验证](docs/verification.md)说明测试范围、文件保留规则及平台验证边界。

```bash
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
corepack pnpm test:python
corepack pnpm exec playwright install --with-deps chromium
corepack pnpm test:ui
# 可选：调用本机已登录的真实 Codex，会消耗模型额度
node scripts/smoke-codex.mjs
```

测试包括调度、权限、配置快照、持久恢复、Git 和非 Git 目录、真实子进程、MCP stdio、Python doorbell、HTTP/SSE 与 Chromium 页面操作。常规测试使用受控 harness / CLI fixture，不消耗模型额度。`smoke-codex.mjs` 额外验证真实 Codex 的 MCP 注入、fork、上下文 resume。

Claude 作为第二个适配器共用同一 `Harness` 接口，使用 `claude -p --output-format stream-json --verbose --dangerously-skip-permissions`。普通测试验证其事件/参数契约和子进程调度；真实 Claude 运行依赖本机登录与 CLI 的运行限制。

平台代码包含 Linux reflink/systemd、macOS APFS clone/launchd 分支。当前自动验收在 Linux 上执行；macOS 安装与服务需在目标机器执行相同验收。

Codex 实现时已核对本机 `codex exec --help`、`codex exec resume --help` 及 [OpenAI 配置参考](https://developers.openai.com/codex/config-reference)、[非交互执行文档](https://developers.openai.com/codex/noninteractive)。配置值按 TOML 编码，prompt 走 stdin，命令通过无 shell 的参数数组启动。
