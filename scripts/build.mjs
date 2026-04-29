import { mkdir } from "node:fs/promises";

await mkdir("public", { recursive: true });
console.log("Static Web UI ready in public/.");
