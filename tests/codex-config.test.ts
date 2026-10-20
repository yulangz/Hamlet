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
  emptyTable: "[mcp_servers.detached]\n",
  incomplete: "[mcp_servers.detached]\nenabled = false\n",
  stdio:
    '[mcp_servers.detached]\ncommand = "legacy-must-not-start"\nargs = ["old"]\n',
  http: '[mcp_servers.detached]\nurl = "http://127.0.0.1:1/legacy-must-not-connect"\n',
};
const transports: Record<string, Record<string, unknown>> = {
  absent: {},
  emptyTable: {},
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
    for (const namespace of ["hamlet", "detached"]) {
      for (const mode of ["fork", "resume"] as const) {
        for (const layer of [
          "user",
          "project",
          "options-table",
          "options-dotted",
        ] as const) {
          for (const [kind, config] of Object.entries(configs)) {
            await t.test(`${namespace}/${mode}: ${layer}/${kind}`, () => {
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
                  trust +
                    sentinel +
                    (layer === "user"
                      ? config.replaceAll("detached", namespace)
                      : ""),
                );
                writeFileSync(
                  projectConfig,
                  layer === "project"
                    ? config.replaceAll("detached", namespace) + sentinel
                    : "",
                );
                const before = [userConfig, projectConfig].map((p) =>
                  readFileSync(p, "utf8"),
                );
                const o = {
                  cwd,
                  systemPrompt: "system",
                  prompt: "unused: config-only check",
                  env: {
                    CODEX_HOME: home,
                    HAMLET_TOKEN: "test-identity",
                    HAMLET_INSTANCE_ID: "test-1",
                  },
                  options: {
                    ...(layer === "options-table"
                      ? {
                          mcp_servers:
                            kind === "absent"
                              ? {}
                              : { [namespace]: transports[kind] },
                        }
                      : {}),
                    ...(layer === "options-dotted" && kind === "emptyTable"
                      ? { [`mcp_servers.${namespace}`]: {} }
                      : layer === "options-dotted"
                        ? Object.fromEntries(
                            Object.entries(transports[kind]).map(
                              ([key, value]) => [
                                `mcp_servers.${namespace}.${key}`,
                                value,
                              ],
                            ),
                          )
                        : {}),
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
                const legacy = servers.find((s: any) => s.name === namespace);
                if (kind === "absent") {
                  assert.equal(legacy, undefined);
                } else {
                  assert.equal(legacy.enabled, false);
                  assert.equal(
                    legacy.transport.type,
                    kind === "http" ? "streamable_http" : "stdio",
                  );
                  if (kind === "stdio")
                    assert.equal(
                      legacy.transport.command,
                      "legacy-must-not-start",
                    );
                  if (kind === "incomplete" || kind === "emptyTable") {
                    assert.equal(legacy.transport.command, process.execPath);
                    assert.deepEqual(legacy.transport.args, []);
                  }
                  assert.equal(legacy.transport.env?.HAMLET_TOKEN, undefined);
                }
                assert.ok(!args.some((a) => a.includes("test-identity")));
                assert.equal(
                  servers.find(
                    (s: any) =>
                      s.name ===
                      (namespace === "hamlet" ? "detached" : "hamlet"),
                  ),
                  undefined,
                );
                assert.ok(servers.some((s: any) => s.name === "unrelated"));
                assert.deepEqual(
                  [userConfig, projectConfig].map((p) =>
                    readFileSync(p, "utf8"),
                  ),
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
    }
  },
);
