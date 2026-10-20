import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { VERSION } from "../../core/src/types.js";
import { connect, type Client } from "../../core/src/client.js";
const str = { type: "string" },
  obj = { type: "object", additionalProperties: true },
  bool = { type: "boolean" };
const fields: Record<string, any> = {
  id: str,
  logical_id: str,
  instance_id: str,
  message_id: str,
  source: {
    type: "string",
    enum: ["host", "ui", "ring", "message_to", "doorbell_script"],
  },
  from_id: str,
  status: str,
  since: str,
  until: str,
  limit: { type: "integer", minimum: 1, maximum: 500, default: 100 },
  offset: { type: "integer", minimum: 0, default: 0 },
  order: { type: "string", enum: ["asc", "desc"], default: "asc" },
  name: str,
  group: str,
  role_name: str,
  identity: { type: "string", enum: ["admin", "worker"] },
  harness: { type: "string", enum: ["codex", "claude"] },
  model: str,
  harness_options: obj,
  extra_env: obj,
  system_prompt_tpl: str,
  prompt_tpl: str,
  run_mode: { type: "string", enum: ["fork", "resident"] },
  workdir: str,
  worktree: bool,
  migrate: bool,
  git_init: bool,
  base_ref: str,
  doorbell_script: str,
  doorbell_enabled: bool,
  target: str,
  prompt: str,
  system_prompt: str,
  vars: obj,
  dedup_key: str,
  dedup_window: str,
  action: { type: "string", enum: ["start", "stop", "restart"] },
};
const specs: Record<
  string,
  { keys: string[]; required?: string[]; description: string }
> = {
  group_create: {
    keys: ["name"],
    required: ["name"],
    description: "创建一座坊（group）",
  },
  group_delete: {
    keys: ["id"],
    required: ["id"],
    description: "删除坊（group）和其中的 Agent",
  },
  group_list: { keys: [], description: "列出所有坊（group）" },
  agent_create: {
    keys: [
      "group",
      "role_name",
      "identity",
      "harness",
      "model",
      "harness_options",
      "extra_env",
      "system_prompt_tpl",
      "prompt_tpl",
      "run_mode",
      "workdir",
      "worktree",
      "migrate",
      "git_init",
      "base_ref",
      "doorbell_script",
      "doorbell_enabled",
    ],
    required: ["role_name", "workdir"],
    description:
      "创建逻辑 Agent（不运行）。worktree=false 的相同目录会全局串行，返回 execution 说明；非空目录迁移需要 migrate=true，否则返回 needs_migration 和目录摘要",
  },
  agent_update: {
    keys: [
      "id",
      "role_name",
      "identity",
      "harness",
      "model",
      "harness_options",
      "extra_env",
      "system_prompt_tpl",
      "prompt_tpl",
      "run_mode",
      "workdir",
      "worktree",
      "migrate",
      "git_init",
      "doorbell_script",
      "doorbell_enabled",
    ],
    required: ["id"],
    description: "修改逻辑配置，只影响之后的 fork",
  },
  agent_delete: {
    keys: ["id"],
    required: ["id"],
    description: "停止运行、归档实例并删除逻辑 Agent",
  },
  agent_list: { keys: ["group"], description: "列出逻辑 Agent 和实例" },
  agent_get: { keys: ["id"], required: ["id"], description: "查询逻辑 Agent" },
  instance_get: {
    keys: ["id"],
    required: ["id"],
    description: "查询实例、运行历史、最后输出",
  },
  instance_archive: {
    keys: ["id"],
    required: ["id"],
    description: "归档实例并清理 worktree",
  },
  instance_renew_resident: {
    keys: ["logical_id"],
    required: ["logical_id"],
    description: "换新常驻实例，下次触发时 fork",
  },
  run_stop: {
    keys: ["instance_id"],
    required: ["instance_id"],
    description: "终止实例的当前运行",
  },
  message_to: {
    keys: [
      "target",
      "group",
      "prompt",
      "system_prompt",
      "vars",
      "dedup_key",
      "dedup_window",
    ],
    required: ["target"],
    description:
      "异步入队，每条消息触发一次 fork/resume，不会插入运行中的回合。返回消息 ID、queue_reason 和 next_action；入队不表示已运行。相同 direct 目录串行，勿在当前回合等待共用目录的 Agent 回复。Owner 来源标为宿主调用方，并不代表用户本人。目标可用 ID 或同组角色名",
  },
  message_list: {
    keys: [
      "group",
      "logical_id",
      "instance_id",
      "target",
      "source",
      "from_id",
      "status",
      "since",
      "until",
      "limit",
      "offset",
      "order",
    ],
    description:
      "Owner 只读查询消息、来源、当前排队原因、阻塞实例/run、等待时长。logical_id 含发给其实例的消息，target 精确匹配目标 ID。since/until 按消息创建时间过滤。数组分页默认100条、最多500条，order 默认 asc；不会触发调度。",
  },
  message_get: {
    keys: ["id"],
    required: ["id"],
    description:
      "Owner 只读查询一条消息及所有运行尝试，包括重试前历史、当前排队原因和通信来源。",
  },
  run_list: {
    keys: [
      "group",
      "logical_id",
      "instance_id",
      "message_id",
      "source",
      "from_id",
      "status",
      "since",
      "until",
      "limit",
      "offset",
      "order",
    ],
    description:
      "Owner 只读查询运行历史与结果，包括耗时、等待时长、实际 prompt、最终输出、用量和触发来源。支持已删除 Agent 的历史。since/until 按运行开始时间过滤；数组分页默认100条，最多500条。",
  },
  run_get: {
    keys: ["id"],
    required: ["id"],
    description:
      "Owner 只读查询单次运行、结果和触发消息快照。历史 prompt 保留实际投递内容；trigger_is_snapshot=false 表示旧记录无触发快照。",
  },
  run_events: {
    keys: ["id", "limit", "offset", "order"],
    required: ["id"],
    description:
      "Owner 只读查询运行的标准化事件（警告、工具、命令、错误等）。数组分页默认100条、最多500条；offset 按所选排序跳过事件。",
  },
  doorbell_control: {
    keys: ["logical_id", "action"],
    required: ["logical_id", "action"],
    description: "启停或重启自定义 doorbell",
  },
  doorbell_logs: {
    keys: ["logical_id"],
    required: ["logical_id"],
    description: "查询 doorbell 日志",
  },
  ui_open: { keys: [], description: "返回带身份令牌的 Web UI 地址" },
  whoami: {
    keys: [],
    description: "查询自己的 ID、角色、group、身份和共享目录",
  },
  group_agents: { keys: [], description: "列出本组所有 Agent、实例和状态" },
};
export function toolsFor(identity: string, inner: boolean) {
  const names = inner
    ? [
        "whoami",
        "group_agents",
        "instance_get",
        "message_to",
        ...(identity === "admin"
          ? [
              "agent_create",
              "agent_update",
              "agent_delete",
              "instance_archive",
              "run_stop",
              "doorbell_control",
              "doorbell_logs",
            ]
          : []),
      ]
    : Object.keys(specs).filter((n) => !["whoami", "group_agents"].includes(n));
  return names.map((name) => {
    const s = specs[name];
    return {
      name,
      description: s.description,
      inputSchema: {
        type: "object" as const,
        properties: Object.fromEntries(s.keys.map((k) => [k, fields[k]])),
        required: s.required || [],
        additionalProperties: false,
      },
    };
  });
}
export async function serve(inner = false, client?: Client) {
  const c = client || (await connect(!inner));
  let identity = "owner";
  if (inner) {
    const info = await c.call("whoami");
    identity = info.identity;
    if (!["worker", "admin"].includes(identity))
      throw new Error("内置工具集必须使用实例令牌");
  }
  const list = toolsFor(identity, inner);
  const server = new Server(
    { name: inner ? "hamlet-inner" : "hamlet-host", version: VERSION },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: list,
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (!list.some((t) => t.name === req.params.name))
      return { isError: true, content: [{ type: "text", text: "未知工具" }] };
    try {
      const params = { ...req.params.arguments };
      if (
        ["message_list", "run_list", "run_events"].includes(req.params.name) &&
        params.limit === undefined
      )
        params.limit = 100;
      const result = await c.call(req.params.name, params);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (e: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: e.message, details: e.details }),
          },
        ],
      };
    }
  });
  await server.connect(new StdioServerTransport());
  return server;
}
