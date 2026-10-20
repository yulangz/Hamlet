import { serve } from "../../mcp-host/src/server.js";
serve(true).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
