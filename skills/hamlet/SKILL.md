---
name: hamlet
description: 使用 Hamlet 的 CLI/HTTP 创建和管理后台 Codex/Claude Agent、group、独立会话及事件驱动协作。
---

# Hamlet

Hamlet daemon 持久化 Agent、会话、消息和运行；宿主会话结束后，后台任务仍可继续。Owner 和后台 Agent 共用本 skill，按当前身份阅读。

## Owner：连接与配置

沿用用户已选定的服务和凭据来源。连接现有服务时，将 `HAMLET_URL` 与 `HAMLET_TOKEN` 成对绑定；连接失败就报告，不清除配置改连其他服务。只有获得启动授权才执行 `start`，并以返回的 URL 为准。未绑定连接的 `call`、`ring`、`ui` 可能自动启动本机服务，不能用来探测服务。连接步骤见 [API](references/api.md#服务连接)。

创建前整理模型、会话模式、权限、工作目录、任务职责、资源和启动时机，见 [配置](references/configuration.md)。沿用已有选择；常规实现细节可在授权范围内确定并说明。只询问会实质影响任务且无法从上下文确定的缺项，不要求用户逐字段填写 API。迁移已有目录、替换常驻会话或扩大资源使用前，确认已有授权涵盖其影响。用户要求“仅创建”时不发送任务，并关闭 doorbell。

## Agent：使用实例身份

使用环境提供的连接与 CLI：`"$HAMLET_NODE" "$HAMLET_CLI" call whoami '{}'`。`whoami.id` / `HAMLET_INSTANCE_ID` 是自己的真实实例 ID。沿用注入的身份；认证失败时报告错误，不读取 Owner secret 或清除身份环境重试。凭据只通过环境或 HTTP 认证头使用，不写入 prompt、命令参数或共享文件，也不打印。

Owner 管理所有 group；admin 管理本组 worker；worker 在本组查询和通信。权限由服务端校验，这不是文件系统沙箱。

## 消息与协作

`message_to` 的 **target 决定 fork/resume，没有 mode 参数**：

- 逻辑短 ID（如 `abcdef`）：`run_mode=fork` 创建新会话；`resident` 首次创建，之后复用常驻会话。
- 真实长 ID（如 `abcdef-1`）：resume 指定会话，适用于同一任务的补充、修复和结果回复，与 run_mode 无关。

派发时记录任务版本、目标逻辑 ID 和派发者的真实回复 ID；接收者登记自己的真实实例 ID。不要猜测实例序号，或用逻辑 ID 代替已有任务的回复地址。参数、回执和去重见 [API](references/api.md#message_to)。

每条消息入队一个执行回合，不会插入正在运行的回合。入队回执不代表完成；查询不会唤醒 Agent。派发后结束回合等待约定事件；进度写共享状态，结果、阻塞或待决策事项才发送通知。不要用自发消息轮询，也不回复纯 ACK。

服务没有自动任务终态回调。协作任务需约定结果文件、完成通知和失败处理；进程崩溃或模型调用失败时，Agent 可能无法通知，需由 Owner 或监控检查运行状态。事件使用稳定的 `dedup_key`，业务侧仍需按任务版本防止重复处理。Leader/Worker 的完整交接示例见 [协作](references/collaboration.md)。

收尾按约定停止触发器、处理剩余队列并保留或清理资源。停止 daemon 会影响所有 group。
