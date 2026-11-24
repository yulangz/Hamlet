---
name: hamlet
description: 在用户要求打开 Hamlet 主助理或连接其 HAMLET Hub 时使用。
---

# 打开主助理

在 HAMLET 的「创建会话」中选择「打开 Hamlet 主助理」。命令行可在 Hamlet 仓库运行 `node bin/hamlet.js start`，获取同一会话的链接。连接远端 Hub 时使用 HAMLET_API_URL 和已有 HAMLET 登录配置。

主助理运行在 Hub 的本机 Runner，记录需求、向直属 Agent 派工并回复用户。会话中的 `machine_list` 返回机器 ID、显示名和在线状态。用户在 HAMLET 修改机器名后，创建 Agent 时仍沿用该机器的 ID。
