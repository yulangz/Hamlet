import type {
  Harness,
  StartOptions,
  ResumeOptions,
  AgentEvent,
} from "../../core/src/types.js";
import { runtimeEnv, childEnvironment } from "../../core/src/runtime.js";
import { runProcess, stopProcess } from "./process.js";
import { assertCodexShellEnvironment } from "./environment.js";
import { spawnSync } from "node:child_process";
function toml(v: unknown): string {
  if (v === null) throw Error("TOML 不支持 null");
  if (Array.isArray(v)) return `[${v.map(toml).join(",")}]`;
  if (typeof v === "object")
    return `{${Object.entries(v as object)
      .map(([k, x]) => `${JSON.stringify(k)} = ${toml(x)}`)
      .join(",")}}`;
  return JSON.stringify(v);
}
export function codexArgs(
  o: StartOptions | ResumeOptions,
  legacy: Record<string, "preserve" | "fallback"> = {},
): string[] {
  const resume = "sessionId" in o;
  const args = [
    "exec",
    ...(resume ? ["resume", o.sessionId] : []),
    "--json",
    "--dangerously-bypass-approvals-and-sandbox",
    "--skip-git-repo-check",
  ];
  if (o.model) args.push("-m", o.model);
  const settings: Record<string, unknown> = { ...o.options };
  // Disable inherited Hamlet MCPs during transition. No tool process or
  // credential is injected; unrelated user MCPs remain the user's choice.
  for (const [name, transport] of Object.entries(legacy)) {
    settings[`mcp_servers.${name}.enabled`] = false;
    if (transport === "fallback") {
      settings[`mcp_servers.${name}.command`] = process.execPath;
      settings[`mcp_servers.${name}.args`] = [];
    }
  }
  if (!resume)
    settings.developer_instructions = (o as StartOptions).systemPrompt;
  for (const [k, v] of Object.entries(settings)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(k)) throw Error("无效的 harness 配置键");
    args.push("-c", `${k}=${toml(v)}`);
  }
  args.push("-");
  return args;
}
export function codexLaunchArgs(
  command: string,
  o: StartOptions | ResumeOptions,
): string[] {
  const legacy: Record<string, "preserve" | "fallback"> = {};
  // Read effective user/project/option configuration without starting servers
  // or a model. Absent entries stay absent. Codex still validates disabled
  // transports, so only malformed legacy entries get a credential-free stub.
  for (let attempt = 0; attempt < 3; attempt++) {
    const args = codexArgs(o, legacy);
    const configArgs = args.flatMap((arg, i) =>
      arg === "-c" ? [arg, args[i + 1]] : [],
    );
    const probe = spawnSync(command, ["mcp", "list", "--json", ...configArgs], {
      cwd: o.cwd,
      env: { ...childEnvironment(), ...o.env },
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    if (probe.status === 0) {
      try {
        for (const server of JSON.parse(probe.stdout))
          if (["hamlet", "detached"].includes(server.name))
            legacy[server.name] ??= "preserve";
      } catch {
        throw new Error(
          "无法解析 Codex 有效配置；未启动子 Agent，请检查 codex mcp list --json",
        );
      }
      return codexArgs(o, legacy);
    }
    const malformed =
      /invalid transport\s+in `mcp_servers\.(hamlet|detached)`/.exec(
        probe.stderr || "",
      );
    if (!malformed || legacy[malformed[1]] === "fallback")
      throw new Error(
        "无法检查 Codex 有效配置；未启动子 Agent，请检查 codex mcp list --json",
      );
    legacy[malformed[1]] = "fallback";
  }
  return codexArgs(o, legacy);
}
export function normalize(raw: any): AgentEvent[] {
  switch (raw.type) {
    case "thread.started":
      return [{ type: "session_started", session_id: raw.thread_id }];
    case "turn.completed":
      return [{ type: "usage", usage: raw.usage }];
    case "error":
    case "turn.failed":
      return [
        {
          type: "error",
          message: raw.message || raw.error?.message || "Codex turn failed",
        },
      ];
    case "item.started":
    case "item.updated":
    case "item.completed": {
      const i = raw.item || {},
        phase = raw.type.split(".")[1];
      switch (i.type) {
        case "agent_message":
          return phase === "completed"
            ? [{ type: "assistant_message", text: i.text }]
            : [];
        case "reasoning":
          return [{ type: "reasoning", text: i.text, phase }];
        case "command_execution":
          return [
            {
              type: "command",
              command: i.command,
              output: i.aggregated_output,
              exit_code: i.exit_code,
              phase,
            },
          ];
        case "file_change":
          return [{ type: "file_change", changes: i.changes, phase }];
        case "mcp_tool_call":
        case "web_search":
          return [
            {
              type: phase === "completed" ? "tool_result" : "tool_call",
              ...i,
              phase,
              harness_type: i.type,
            } as AgentEvent,
          ].map((e) => ({
            ...e,
            type: phase === "completed" ? "tool_result" : "tool_call",
          }));
        default:
          return [];
      }
    }
    default:
      return [];
  }
}
export class CodexHarness implements Harness {
  name = "codex";
  constructor(public command = runtimeEnv("CODEX_BIN") || "codex") {}
  start(o: StartOptions) {
    return this.launch(o);
  }
  resume(o: ResumeOptions) {
    return this.launch(o);
  }
  private launch(o: StartOptions | ResumeOptions) {
    const args = codexLaunchArgs(this.command, o);
    assertCodexShellEnvironment(this.command, args, o);
    return runProcess(
      this.command,
      args,
      o.cwd,
      o.env,
      o.prompt,
      normalize,
      (r) => (r.type === "thread.started" ? r.thread_id : undefined),
    );
  }
  stop = stopProcess;
}
