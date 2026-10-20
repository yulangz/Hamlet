import { serve } from "./server.js";
serve().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
