# Hamlet · 坊

Hamlet 的 Agent、群、消息、提醒和 doorbell 由本项目配套的 HAMLET Hub 与 Runner 托管。启动更新后的 HAMLET Hub，并在 Hub 主机及要使用的其他机器启动同版本 Runner。Hub 本机的 Runner 与 Hub 使用同一个 HAMLET_HOME。

在 HAMLET「创建会话」页面选择「打开 Hamlet 主助理」，或运行：

```sh
node bin/hamlet.js start
```

CLI 默认连接本机 3006 端口，支持 HAMLET_API_URL 和 CLI_API_TOKEN。重复调用打开同一主助理。父 Agent 使用会话里的 Hamlet MCP 工具创建和管理直属子节点。子 Agent 的 Codex 会话、工作目录以及调度记录均由 HAMLET 保存。

旧 daemon 的数据目录可保留供查阅。新版不会自动导入旧会话、监听脚本或待处理消息。

运行 `npm run check` 可验证本仓库的 HAMLET 入口和 doorbell 命令。Hub、Runner、Web 和协作协议的构建及测试位于配套 HAMLET 仓库。
