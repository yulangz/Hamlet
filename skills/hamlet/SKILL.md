---
name: hamlet
description: 用户要打开 Hamlet 主助理、获取会话链接或检查 Hub 是否可用时使用。
---

# 打开主助理

使用本 skill 自带的 `scripts/hamlet`，从 skill 的目录解析脚本路径。在 Hamlet Web 的「创建会话」中选择「打开 Hamlet 主助理」也能进入同一会话。

1. 运行 `scripts/hamlet status` 检查 Hub。默认地址为 `http://127.0.0.1:3006`，远端地址由 HAMLET_API_URL 指定。如果连接失败，向用户报告目标地址和错误，请用户确认 Hub 是否运行。
2. 运行 `scripts/hamlet start` 获取链接。命令使用 CLI_API_TOKEN，或读取 HAMLET_HOME 下 settings.json 的 cliApiToken（默认目录为 ~/.hamlet）。鉴权失败时请用户核对目标 Hub 的凭据，保持令牌私密。如果提示本机 Runner 离线，请用户启动 Hub 所在机器的 Hamlet Runner。
3. 把会话链接交给用户。如果用户已在当前对话描述任务，把目标、背景和期望交付整理成可直接粘贴给主助理的话。主助理在该会话里负责派工和汇总。
