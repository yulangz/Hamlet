# Hamlet · 坊

Hamlet Hub 管理 Agent、群、消息和定时提醒。各台机器上的 Hamlet Runner 启动 Codex 会话并运行 doorbell 监听脚本。启动 Hub，并在 Hub 主机及要使用的其他机器启动同版本 Runner。Hub 本机的 Runner 与 Hub 使用同一个 HAMLET_HOME。

在 Hamlet Web 的「创建会话」页面选择「打开 Hamlet 主助理」，或运行：

```sh
node bin/hamlet.js start
```

CLI 默认连接本机 3006 端口，支持 HAMLET_API_URL 和 CLI_API_TOKEN。重复调用打开同一主助理，保留 Hub 已记录的时区。需要显式更新时可设置 HAMLET_USER_TIMEZONE，例如 Asia/Shanghai。运行中的 Agent 在下次启动时采用新时区。父 Agent 使用会话里的 Hamlet MCP 工具创建和管理直属子节点。子 Agent 的 Codex 会话、工作目录以及调度记录由 Hub 与所在机器的 Runner 保存。

旧 daemon 的源码、文档、模板和测试保存在 [archive](archive/README.md)。旧数据目录可保留供查阅。新版不会自动导入旧会话、监听脚本或待处理消息。

运行 `npm run check` 可验证本仓库的主助理入口和 doorbell 命令。Hub、Runner、Web 和协作协议的构建及测试位于配套的 Hub 仓库。

Runner 在托管会话的开发者指令中给出协作指南 `hamlet-agent` 的本机路径，供 Agent 按需读取。Runner 还为监听脚本提供 doorbell Python SDK，脚本可通过 `from doorbell import ring` 导入上报函数。此仓库的 `doorbell ring` 命令供有 DOORBELL_URL 和 DOORBELL_TOKEN 的环境手动调试。
