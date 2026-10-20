import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexLaunchArgs } from "../packages/harness-codex/src/index.js";

// Opt in to a real, locally installed CLI. This command only loads configuration;
// it does not log in, start MCP servers, or make paid model requests.
const command = process.env.HAMLET_CODEX_CONFIG_TEST_BIN;
const configs = {
  absent: "",
  incomplete: "[mcp_servers.detached]\nenabled = false\n",
  stdio:
    '[mcp_servers.detached]\ncommand = "legacy-must-not-start"\nargs = ["old"]\n',
  http: '[mcp_servers.detached]\nurl = "http://127.0.0.1:1/legacy-must-not-connect"\n',
};
const transports: Record<string, Record<string, unknown>> = {
  absent: {},
  incomplete: { enabled: false },
  stdio: { command: "legacy-must-not-start", args: ["old"] },
  http: { url: "http://127.0.0.1:1/legacy-must-not-connect" },
};

function configArgs(args: string[]) {
  return args.flatMap((arg, i) => (arg === "-c" ? [arg, args[i + 1]] : []));
}

test(
  "真实 Codex 配置解析：fork/resume、用户/项目信任层、缺失/旧传输和 harness 覆盖",
  {
    skip:
      !command &&
      "set HAMLET_CODEX_CONFIG_TEST_BIN=codex for config-only validation",
  },
  async (t) => {
    for (const mode of ["fork", "resume"] as const) {
      for (const layer of [
        "user",
        "project",
        "options-table",
        "options-dotted",
      ] as const) {
        for (const [kind, config] of Object.entries(configs)) {
          await t.test(`${mode}: ${layer}/${kind}`, () => {
            const dir = mkdtempSync(join(tmpdir(), "hamlet-codex-config-"));
            try {
              const home = join(dir, "codex-home"),
                cwd = join(dir, "project");
              mkdirSync(home);
              mkdirSync(join(cwd, ".codex"), { recursive: true });
              const userConfig = join(home, "config.toml");
              const projectConfig = join(cwd, ".codex", "config.toml");
              const trust = `[projects.${JSON.stringify(cwd)}]\ntrust_level = "trusted"\n`;
              const sentinel =
                '[mcp_servers.unrelated]\ncommand = "unrelated-must-not-start"\n';
              writeFileSync(
                userConfig,
                trust + sentinel + (layer === "user" ? config : ""),
              );
              writeFileSync(
                projectConfig,
                layer === "project" ? config + sentinel : "",
              );
              const before = [userConfig, projectConfig].map((p) =>
                readFileSync(p, "utf8"),
              );
              const o = {
                cwd,
                systemPrompt: "system",
                prompt: "unused: config-only check",
                env: { CODEX_HOME: home },
                innerTools: {
                  command: process.execPath,
                  args: ["/hamlet-inner-must-not-start"],
                  env: {
                    HAMLET_TOKEN: "test-identity",
                    HAMLET_INSTANCE_ID: "test-1",
                  },
                },
                // Also ensure an agent cannot re-enable the legacy namespace.
                options: {
                  ...(layer === "options-table"
                    ? { mcp_servers: { detached: transports[kind] } }
                    : {}),
                  ...(layer === "options-dotted"
                    ? Object.fromEntries(
                        Object.entries(transports[kind]).map(([key, value]) => [
                          `mcp_servers.detached.${key}`,
                          value,
                        ]),
                      )
                    : {}),
                  "mcp_servers.detached.enabled": true,
                },
                ...(mode === "resume" ? { sessionId: "unused-session" } : {}),
              };
              const args = codexLaunchArgs(command!, o);
              const parsed = spawnSync(
                command!,
                ["mcp", "list", "--json", ...configArgs(args)],
                {
                  cwd,
                  env: { ...process.env, ...o.env },
                  encoding: "utf8",
                  timeout: 10000,
                },
              );
              assert.equal(
                parsed.status,
                0,
                parsed.stderr || String(parsed.error),
              );
              const servers = JSON.parse(parsed.stdout);
              const detached = servers.find((s: any) => s.name === "detached");
              assert.equal(detached.enabled, false);
              assert.equal(
                detached.transport.type,
                kind === "http" ? "streamable_http" : "stdio",
              );
              if (kind === "stdio")
                assert.equal(
                  detached.transport.command,
                  "legacy-must-not-start",
                );
              if (kind === "absent" || kind === "incomplete") {
                assert.equal(detached.transport.command, process.execPath);
                assert.deepEqual(detached.transport.args, []);
                assert.equal(detached.transport.env?.HAMLET_TOKEN, undefined);
              }
              const hamlet = servers.find((s: any) => s.name === "hamlet");
              assert.equal(hamlet.enabled, true);
              assert.equal(hamlet.transport.command, o.innerTools.command);
              assert.deepEqual(hamlet.transport.args, o.innerTools.args);
              assert.deepEqual(hamlet.transport.env, o.innerTools.env);
              assert.ok(servers.some((s: any) => s.name === "unrelated"));
              assert.deepEqual(
                [userConfig, projectConfig].map((p) => readFileSync(p, "utf8")),
                before,
              );
              if (mode === "resume") {
                assert.deepEqual(args.slice(0, 3), [
                  "exec",
                  "resume",
                  "unused-session",
                ]);
                assert.ok(
                  !args.some((a) => a.startsWith("developer_instructions=")),
                );
              }
            } finally {
              rmSync(dir, { recursive: true, force: true });
            }
          });
        }
      }
    }
  },
);
