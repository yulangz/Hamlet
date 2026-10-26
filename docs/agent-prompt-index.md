# Hamlet 提供给 Agent 的 prompt 与工具文案索引

这是当前代码的审阅快照（2026-10-26）。本文件不会自动注入 Agent；修改应回到标注的源文件。

涵盖：模型任务正文、system prompt 拼接、runtime 原文、skill 及按需参考文档、注册工具的描述与参数、工具回执中的行为说明。Owner 指南和 Web UI 文案不属于本清单。

## P01 · system prompt 的选择与共享目录

位置：[packages/core/src/service.ts:1012](../packages/core/src/service.ts#L1012)

作用时机：仅新实例。消息 system_prompt 优先，否则渲染 system_prompt_tpl；有共享目录则追加下面的行。resume 复用原会话，忽略新 system_prompt 并记录警告。

````text
用户配置的 system prompt
共享目录: <shared_path>

共享目录为空时不追加第二行。
````

## P02 · 任务正文与来源头

位置：[packages/core/src/service.ts:1036](../packages/core/src/service.ts#L1036)

作用时机：每回合，包括 fork 和 resume。消息 prompt 优先，否则渲染实例配置的 prompt_tpl。

````text
[来自 <sender.label><来源身份后缀>]
<任务正文>

<下列 P03—P13 runtime>

Owner 后缀为 (owner)；实例后缀为 (<发送实例 ID>)；doorbell 没有额外后缀。
````

## P03 · runtime 标记

位置：[packages/core/src/service.ts:1018](../packages/core/src/service.ts#L1018)

作用时机：每回合。

````text
[Hamlet runtime]
````

## P04 · 当前身份

位置：[packages/core/src/service.ts:1019](../packages/core/src/service.ts#L1019)

作用时机：每回合，从当前逻辑 Agent 配置读取身份；resume 后也反映最新 admin/worker 身份。

````text
You are a Hamlet Agent. Your identity is <admin 或 worker>.
````

## P05 · 系统权限与业务角色

位置：[packages/core/src/service.ts:1020](../packages/core/src/service.ts#L1020)

作用时机：每回合。

````text
Hamlet Agent identities are admin and worker: both can query and communicate within their group; admin can also manage workers in that group. Task roles are assigned by the user.
````

## P06 · 逻辑与真实实例 ID

位置：[packages/core/src/service.ts:1021](../packages/core/src/service.ts#L1021)

作用时机：每回合，提供当前真实 ID。

````text
Identity: logical_id=<逻辑短 ID>; instance_id=<真实实例长 ID>.
````

## P07 · skill 路径

位置：[packages/core/src/service.ts:1022](../packages/core/src/service.ts#L1022)

作用时机：每回合。指向该工作目录中的 skill，只有需要使用 Hamlet 时要求读取。

````text
Before using Hamlet, read "<实际工作目录>/.agents/skills/hamlet-agent/SKILL.md".

Claude 路径使用 .claude/skills/hamlet-agent/SKILL.md。
````

## P08 · admin CLI 入口

位置：[packages/core/src/service.ts:1025](../packages/core/src/service.ts#L1025)

作用时机：仅当前身份为 admin 的回合；worker 不注入这一行。

````text
CLI: "$HAMLET_NODE" "$HAMLET_CLI" call <tool> '<JSON>'; whoami '{}' verifies your instance identity.
````

## P09 · 凭据与身份

位置：[packages/core/src/service.ts:1028](../packages/core/src/service.ts#L1028)

作用时机：每回合。

````text
Use the injected HAMLET_URL/HAMLET_TOKEN. Keep credentials out of prompts, command arguments and logs; do not read Owner secrets or replace your identity.
````

## P10 · 消息路由

位置：[packages/core/src/service.ts:1029](../packages/core/src/service.ts#L1029)

作用时机：每回合。

````text
message_to has no mode parameter: logical short ID + run_mode=fork creates a new session; real instance long ID resumes that session in either mode; resident logical ID creates or reuses its resident session.
````

## P11 · 任务续接与回复 ID

位置：[packages/core/src/service.ts:1030](../packages/core/src/service.ts#L1030)

作用时机：每回合。

````text
For existing-task follow-ups and results, use the recorded working_instance_id or reply_to_instance_id. Do not guess instance IDs.
````

## P12 · 本消息回复目标

位置：[packages/core/src/service.ts:1032](../packages/core/src/service.ts#L1032)

作用时机：每回合二选一：发送方为真实实例时给出默认回复 ID；Owner/doorbell 使用第二种文案。

````text
Sender instance: <发送实例 ID>; default reply target for this message unless the task specifies another reply_to_instance_id.

Sender is not an Agent instance; no implicit instance reply target.
````

## P13 · 入队与拒绝确认

位置：[packages/core/src/service.ts:1034](../packages/core/src/service.ts#L1034)

作用时机：每回合。

````text
Each accepted message queues one execution turn, including messages to yourself. It will not interrupt a running turn. If submission is rejected for queue pressure, the error includes a message_id and reason; message_force_push {id: message_id} confirms that rejected message.
````

## S01 · SKILL.md

位置：[skills/hamlet-agent/SKILL.md:1](../skills/hamlet-agent/SKILL.md#L1)

作用时机：创建 Agent 和实际工作目录时安装；每回合刷新。frontmatter 可由宿主进行 skill 发现，正文在 Agent 读取时进入上下文。worker 通常无需与 Hamlet 交互；admin 管理操作按需展开。

````markdown
---
name: hamlet-agent
description: 当 Hamlet Agent 需要了解消息协作方式，或 admin 需要查询、管理本组 Agent 时使用。身份与实例 ID 由运行时提供。
---

# Hamlet：Agent 协作

## 按身份使用

- worker：通常情况下不需要与 Hamlet 交互，专注完成当前任务。需要协作时，按任务约定发送结果、进展或阻塞信息。
- admin：需要查询或管理本组 Agent 时，阅读 [管理操作](references/admin.md)。

## 消息协作

| 消息目标 | 服务行为 |
| --- | --- |
| fork 模式的逻辑短 ID | 创建新实例、新会话 |
| 真实实例长 ID | resume 指定实例 |
| resident 模式的逻辑短 ID | 首次创建，之后复用常驻实例 |

同一任务的补充和回复使用已记录的真实实例 ID。回复目标优先使用任务指定的 reply_to_instance_id；未指定时，使用 runtime 给出的发送实例。Owner 发起的任务没有隐含实例回复地址，可输出最终结果供其查询。

每条被接受的消息触发一轮执行，包括给自己发消息。消息排队，不会插入正在执行的回合。入队回执不代表任务完成，服务不会自动回复发送者。

工具拒绝消息时会返回原因、排队数量和被拒绝消息的 ID。根据任务需要决定是否继续；确认推送使用返回的 ID。被拒绝消息不会自动入队。
````

## S02 · admin.md

位置：[skills/hamlet-agent/references/admin.md:1](../skills/hamlet-agent/references/admin.md#L1)

作用时机：admin 需要查询、管理组员时，由 S01 引导读取。不会拼进每回合 runtime。

````markdown
# Admin 管理操作

admin 可以在本组查询和通信，并管理本组 worker。运行时提供当前实例身份与连接，CLI 调用方式：

```bash
"$HAMLET_NODE" "$HAMLET_CLI" call whoami '{}'
"$HAMLET_NODE" "$HAMLET_CLI" call group_agents '{}'
```

whoami.id / HAMLET_INSTANCE_ID 是当前真实实例长 ID，group_agents 返回组员的逻辑 ID 与实例列表。凭据通过 HAMLET_URL/HAMLET_TOKEN 使用，不打印凭据、不读取 Owner secret 或替换身份重试。认证失败时报告实际错误。

- 查询、创建、更新或停止本组 worker：按需阅读 [接口](api.md)。
- 设置模型、模板、工作目录和 doorbell：按需阅读 [配置](configuration.md)。

这些权限限定 Hamlet API 操作，不构成文件系统沙箱。
````

## S03 · api.md

位置：[skills/hamlet-agent/references/api.md:1](../skills/hamlet-agent/references/api.md#L1)

作用时机：admin 需要具体接口参数时，由 S02 引导读取。

````markdown
# Admin 接口参考

统一格式：`"$HAMLET_NODE" "$HAMLET_CLI" call 工具名 'JSON'`。多行内容使用 `--stdin` 或 `--file`。HTTP 等价入口为 HAMLET_URL 下的 POST /api/tools/工具名，使用环境中的 HAMLET_TOKEN 作 Bearer 认证。

| 工具 | 参数 | 用途 |
| --- | --- | --- |
| whoami | {} | 实例 ID、角色、group、权限、共享目录 |
| group_agents | {} | 本组逻辑 Agent 和实例 |
| agent_get / agent_list | {id} / {} | 查询组员配置 |
| instance_get | {id} | 查询本组实例、pending_messages、runs |
| run_events | {id,limit?,offset?,order?} | 查看本组运行日志，limit 为 1–500 |
| message_to | {target,prompt?,system_prompt?,vars?,dedup_key?,dedup_window?} | 提交消息，可能因目标积压而拒绝 |
| message_list | {from_id?,target?,status?,limit?,offset?,order?} | 查询本组消息，包括 rejected 记录 |
| message_force_push | {id} | 确认推送自己发送的 rejected 消息 |

message_to 的 prompt 替代目标实例默认任务模板；省略时渲染 prompt_tpl。system_prompt 仅在新会话替代 system_prompt_tpl，resume 会忽略。直接传入的文本不做模板替换，vars 只用于模板。dedup_window 支持 24h、7d 等时长。角色名解析为逻辑节点，角色名#序号解析为真实实例；使用已记录的 ID 可明确路由。

成功返回 JSON；CLI 失败退出码 1，stderr 为 {error,details}，HTTP 使用对应状态码。积压拒绝返回 409：details 包含 code=target_queue_overloaded、message_id、target_id、queued_count、threshold=5、status=rejected 和 confirmation 调用参数。强推成功返回原消息，其状态变为 queued；重复强推返回 409，未知 ID 返回 404，强推其他发送者的消息返回 403（跨组目标不可见）。

Admin 还可管理本组 worker：agent_create、agent_update、agent_delete、instance_archive、instance_renew_resident、run_stop、doorbell_control。涉及创建或更改配置时，从 `$HAMLET_SKILL_DIR/references/configuration.md` 阅读选项；Owner 专用的 group 管理和全局消息重试不向后台实例开放。
````

## S04 · configuration.md

位置：[skills/hamlet-agent/references/configuration.md:1](../skills/hamlet-agent/references/configuration.md#L1)

作用时机：admin 需要创建或更改 Agent 配置时按需读取。

````markdown
# 配置与 prompt

## 创建配置

从当前任务和已有配置确定下列选项。将实际选择写入创建请求，便于复查；只读查询无需配置 Agent。

| 选项 | 含义与选择依据 |
| --- | --- |
| group、role_name | group 是通信和管理边界；role_name 描述用户指定的任务分工，不决定系统权限 |
| identity | worker 在本组查询和通信；admin 可管理本组 worker。协调任务本身不要求 admin |
| harness、model | codex 或 claude；保留用户指定模型。model:null 沿用该 CLI 的模型配置 |
| harness_options | Codex 选项转为 `-c key=TOML`，如 model_reasoning_effort；Claude 当前读取 effort；无覆盖时用 `{}` |
| run_mode | fork 的逻辑触发创建独立会话；resident 的逻辑触发创建或复用常驻会话 |
| workdir、worktree | 绝对路径；direct 使用原目录，worktree 由 Hamlet 创建实例目录，详见下文 |
| system_prompt_tpl、prompt_tpl | 长期职责与默认任务；可为空串，详见下文 |
| extra_env、资源 | extra_env 值须为字符串，无附加环境时 `{}`；资源限额由任务约定或外部调度器执行 |
| doorbell_script、doorbell_enabled | 外部事件脚本的绝对路径及启用状态；不用时 `""`、false |

Agent 由消息触发执行。启用 doorbell 会启动事件脚本，脚本也可发送消息；创建方案应明确是否启用该触发方式。

## prompt 的作用与覆盖规则

| 配置入口 | 内容 | 生效时机 |
| --- | --- | --- |
| agent_create / agent_update 的 system_prompt_tpl | 职责、约束、交付与协作规则 | 新实例创建时 |
| agent_create / agent_update 的 prompt_tpl | 未显式提供任务时使用的默认任务模板 | 每次消息触发 |
| message_to / ring 的 prompt | 本次具体任务，替代 prompt_tpl | 本次回合 |
| message_to / ring 的 system_prompt | 替代 system_prompt_tpl | 仅新实例；resume 时忽略并记录警告 |
| message_to / ring 的 vars | 模板变量值 | 本次模板渲染 |

省略 prompt/system_prompt 才使用相应模板；显式 `""` 会覆盖模板。**只有模板执行 `{{变量}}` 替换，消息中直接提供的 prompt/system_prompt 按原文使用。** 未知模板变量会在创建实例和目录前报错。

内置变量优先于同名 vars：`agent_id` 是真实实例长 ID；`role` 是角色名；`group` 是 group ID；`from` / `from_role` 是发送者 ID / 标签；`worktree` 是实际执行目录；`shared_dir` 是共享目录或空串；`now` 是当前时间。其余变量来自 vars。变量中不要放凭据。

每个实例保留创建时的配置快照。更新逻辑 Agent 的模型、模板、参数和环境只影响新实例；resume 使用原快照，包括原 prompt_tpl。补充当前任务用消息 prompt；需要新长期配置时创建新实例。`instance_renew_resident` 会归档旧常驻实例，下一次逻辑触发才创建新会话。

Hamlet 每回合将来源头、任务正文、`[Hamlet runtime]` 依次组成任务 prompt。runtime 提供身份、skill 路径、路由和队列规则；它由服务端生成，无单独配置字段。新实例的 system prompt 还会附上共享目录路径（如有）。Codex 将其作为 developer_instructions，Claude 使用 append-system-prompt。实际内容可在 run_get 的 prompt/system_prompt 或运行记录中查看。

## 工作目录与并发

- `worktree:false`：直接使用 workdir，不移动文件、不自动提交；git_init/base_ref/migrate 不适用。同一真实目录的运行全局串行，跨 group 也一样。已由外部创建的独立 Git worktree 也可用此模式接入。
- `worktree:true`：管理 root 下的 main/、shared/、worktrees/。新空目录用 git_init:true 初始化 Git，false 使用文件快照。首次遇非空目录且 migrate:false 时返回 409 needs_migration；migrate:true 会将原内容迁入 main/，须有迁移授权。
- Git 实例从 main 的 HEAD 或 base_ref 创建分支 `agent/<实例ID>`；未提交内容不进入新实例，每回合结束会自动提交。已有 Git 仓库迁移后沿用 Git；git_init 只控制空目录初始化。
- 非 Git 实例复制 base/；workdir_refresh 更新后续实例的基准，已有实例保留原基准。base_ref 只适用于 Git。
- 复用目录时沿用已登记的模式和 base_ref，不能靠重传参数重新初始化。不同实例可并发，但同一实例始终串行；独立目录仍需约定外部共享文件的写入责任。

归档实例会停止运行：Git 删除 worktree、保留分支；非 Git 删除实例副本及基准；direct 保留原目录。模型 CLI 的会话文件不会清理。删除逻辑 Agent 会停止运行、归档实例并取消其 queued 消息；删除 group 对组内全部 Agent 执行删除。

## 环境、资源与 doorbell

daemon 注入实例身份和 CLI/skill 路径，extra_env 不能覆盖受保护的身份变量。Codex 启动前校验实际命令环境；若环境过滤移除了这些变量或校验失败，修正具体原因，不通过更换 Owner 身份或放宽整个环境策略绕过。

Hamlet 不调度 GPU 或强制执行资源配额。按任务约定使用外部调度器或环境配置，并明确分配、共享与释放规则。

Doorbell 脚本在外部事件发生时 ring；其 DOORBELL_URL/TOKEN 只能触发绑定目标。脚本需定义事件条件、稳定去重键和计时起点。Python every 首次立即检查，之后每轮完成再等待；从任务提交或截止时间计时需自行持久化时间。入队时间不等于模型执行时间。

脚本崩溃按 1–60 秒退避，10 分钟内第六次崩溃进入 failed，start/restart 可复位。daemon 重启保留 enabled 状态并恢复脚本。
````

## T01 · message_to 的完整工具定义

位置：[packages/agent-tools/src/definitions.ts:4](../packages/agent-tools/src/definitions.ts#L4)

作用时机：Codex/Claude 子进程在 fork 和 resume 时通过实例专属 stdio 服务注册。客户端请求 tools/list 时提供描述和参数 schema；不是任务正文的一部分。

````json
{
  "name": "message_to",
  "description": "向同组 Agent 发送消息。fork 模式的逻辑短 ID 创建新会话；真实实例长 ID resume 指定会话；resident 逻辑 ID 创建或复用常驻会话。每条接受的消息触发一轮执行，包括给自己发送；不会插入正在运行的回合。成功回执只表示入队。目标会话积压时返回拒绝原因、queued_count 和 message_id；确认继续可用 message_force_push。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "target": {
        "type": "string",
        "minLength": 1,
        "description": "目标逻辑短 ID 或真实实例长 ID；同一任务的补充和回复使用真实实例 ID。"
      },
      "prompt": {
        "type": "string",
        "description": "本次任务或回复正文；省略时使用目标的默认任务模板。"
      },
      "system_prompt": {
        "type": "string",
        "description": "仅创建新会话时覆盖 system prompt；resume 时忽略。"
      },
      "vars": {
        "type": "object",
        "additionalProperties": true,
        "description": "目标模板的变量值；prompt 和 system_prompt 中直接提供的文本不做模板替换。"
      },
      "dedup_key": {
        "type": "string",
        "description": "可选去重键；窗口内相同目标和键复用原消息。原消息被拒绝时返回相同拒绝 ID。"
      },
      "dedup_window": {
        "type": "string",
        "description": "去重窗口，例如 24h、7d；默认 24h。"
      }
    },
    "required": [
      "target"
    ],
    "additionalProperties": false
  }
}
````

## T02 · message_force_push 的完整工具定义

位置：[packages/agent-tools/src/definitions.ts:45](../packages/agent-tools/src/definitions.ts#L45)

作用时机：Codex/Claude 子进程在 fork 和 resume 时通过实例专属 stdio 服务注册。客户端请求 tools/list 时提供描述和参数 schema；不是任务正文的一部分。

````json
{
  "name": "message_force_push",
  "description": "确认将自己发送、因积压被拒绝的消息加入目标队尾。使用 message_to 错误中的 message_id，保留原目标和内容。仅接受仍为 rejected 的消息；未知、属于其他发送者或已推送的 ID 会报错。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "minLength": 1,
        "description": "message_to 拒绝回执中的 message_id。"
      }
    },
    "required": [
      "id"
    ],
    "additionalProperties": false
  }
}
````

## R01 · execution.description

位置：[packages/core/src/observe.ts:104](../packages/core/src/observe.ts#L104)

作用时机：Agent 查询组员/实例等接口，返回 execution 信息时；不是自动注入的任务 prompt。

````text
direct 目录：
此 direct 目录由所有使用它的 Agent 全局串行执行；本轮结束才会释放目录。message_to 只入队，不会打断正在运行的回合；共用目录的其他实例在本轮结束后才能执行。

独立实例目录：
不同实例可并行；同一实例按 FIFO 逐条执行。每条被接受的消息都会触发一次运行，不会实时插入正在执行的回合。
````

## R02 · 排队原因

位置：[packages/core/src/service.ts:895](../packages/core/src/service.ts#L895)

作用时机：消息入队回执及查询 queued 消息时，根据当前调度状态返回其一。

````text
group_paused: Group 调度已暂停；消息保留在队列
instance_busy: 该实例正在执行上一回合；当前消息按 FIFO 等待，不会实时送入运行中的会话
workdir_busy: 同一 direct 工作目录全局串行；等待当前回合结束并释放目录
fifo: 等待同一执行队列中更早的消息被调度
awaiting_dispatch: 消息已入队，等待调度器启动下一回合；入队成功不表示已经运行
````

## R03 · 跨组阻塞的简化说明

位置：[packages/core/src/observe.ts:151](../packages/core/src/observe.ts#L151)

作用时机：Agent 查询时，阻塞运行属于其他 group，隐藏其 ID 后返回。

````text
该工作目录被其他运行占用
等待该工作目录中更早的消息被调度
````

## R04 · 消息拒绝与确认

位置：[packages/core/src/service.ts:256](../packages/core/src/service.ts#L256)

作用时机：提交前目标会话已有超过 5 条 queued 消息时，返回错误和已保存的拒绝 ID。

````text
目标 Agent 已有 <X> 条排队消息，本次消息已拒绝。是否确认继续推送？

错误 details 包含 message_id、queued_count、threshold、status=rejected，以及 confirmation={tool:"message_force_push",params:{id:<拒绝 ID>}}。
````

## R05 · 强推失败

位置：[packages/core/src/service.ts:303](../packages/core/src/service.ts#L303)

作用时机：调用 message_force_push 时不满足条件，按相应分支返回。

````text
id 必须是被拒绝消息的 ID
消息不存在
只能强推自己被拒绝的消息
只能强推被拒绝的消息；此消息已推送或不是 rejected 状态
目标实例已归档
````

## R06 · 工具桥接层错误

位置：[packages/agent-tools/src/index.ts:50](../packages/agent-tools/src/index.ts#L50)

作用时机：未知工具、参数错误、身份不匹配或请求失败时，返回 isError=true 和正文 JSON；HTTP 错误保留 statusCode、error、details，拒绝 ID 不丢失。

````text
未知 Hamlet 工具
<参数名> 必填
工具参数 <参数名> 无效
Hamlet 工具仅允许当前 Agent 实例身份
Hamlet 服务连接失败
Hamlet 工具请求失败
````

## R07 · 运行警告

位置：[packages/core/src/service.ts:1123](../packages/core/src/service.ts#L1123)

作用时机：相应情形发生时记录运行事件；Agent 查询日志后可读到，不另行插入运行中的回合。

````text
resume 无法更换 system prompt，已忽略
main 有未提交改动，本次从 HEAD 创建 worktree
````

## R08 · 损坏事件日志说明

位置：[packages/core/src/service.ts:531](../packages/core/src/service.ts#L531)

作用时机：run_events 读取无法解析的日志行时返回。

````text
事件日志中的一行无法解析（可能因进程中断）
````

## I01 · 注入与加载链路

| 入口 | 时机与作用 |
| --- | --- |
| `packages/core/src/service.ts` dispatch | 每回合选择模板、渲染变量、组装 P01—P13；实际 prompt 写入 runs 表。 |
| `packages/core/src/service.ts` execute | 每回合安装 skill，生成实例凭据，设置 HAMLET_AGENT_TOOLS 等运行环境。环境变量本身不是自然语言 prompt。 |
| `packages/core/src/skills.ts` | 安装到工作目录；Codex 为 `.agents/skills/hamlet-agent`，Claude 为 `.claude/skills/hamlet-agent`。脚本及参考文档不会自动全文注入。 |
| `packages/harness-codex/src/index.ts` codexArgs | 新会话 system prompt 使用 developer_instructions；fork/resume 注册 hamlet 工具服务。 |
| `packages/harness-claude/src/index.ts` claudeArgs | 新会话 system prompt 使用 --append-system-prompt；fork/resume 注册 hamlet 工具服务。 |
| `packages/agent-tools/src/index.ts` | 仅声明 tools 能力；没有额外的 server instructions 或 prompts/list 模板。 |

工具协议依据：[Codex 工具配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[Claude 工具配置](https://code.claude.com/docs/en/mcp)、[MCP 工具定义](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)。

## U01 · 用户配置的任务内容与历史会话

`system_prompt_tpl`、`prompt_tpl`、消息 `system_prompt`/`prompt` 是用户或其他 Agent 提供的内容；Hamlet 没有额外的默认业务角色 prompt。模板省略时默认空串。实际发送内容以 `run_get` 的 `system_prompt` 和 `prompt` 为准。

具体任务的模板和消息由部署方管理，不随通用框架发布。修改 skill 不会替换已保存的业务模板或历史会话上下文。
