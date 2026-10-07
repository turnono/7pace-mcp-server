const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { SevenPaceService } = require("./dist/index.js");
const path = require("node:path");

(async () => {
  const date = process.env.SEVENPACE_TEST_DATE;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    throw new Error("Set SEVENPACE_TEST_DATE to YYYY-MM-DD for a bounded read-only probe");
  }
  const transport = new StdioClientTransport({
    command: process.execPath, args: [path.join(__dirname, "dist/index.js")],
    env: { ...process.env, PORT: "6277", MCP_TRANSPORT: "stdio" }, stderr: "pipe",
  });
  const client = new Client({ name: "onprem-live-read-test", version: "1.0" }, { capabilities: {} });
  try {
    await client.connect(transport);
    const list = await client.listTools();
    console.log("MCP initialize and tools/list OK; tools:", list.tools.length);
    for (const [name, args] of [
      ["health", {}], ["list_activity_types", {}],
      ["get_worklogs", { startDate: date, endDate: date }],
      ["generate_time_report", { startDate: date, endDate: date }],
    ]) {
      const result = await client.callTool({ name, arguments: args });
      if (result.isError) throw new Error(name + " failed");
      const text = result.content.filter(c => c.type === "text").map(c => c.text).join("\n");
      if (/failed|unavailable|limited mode/i.test(text)) throw new Error(name + " failed");
      console.log(name, "OK");
    }
    const service = new SevenPaceService({
      baseUrl: process.env.SEVENPACE_BASE_URL,
      token: process.env.SEVENPACE_TOKEN || "",
      organizationName: process.env.SEVENPACE_ORGANIZATION,
    });
    const logs = await service.getWorklogs(undefined, date, date);
    if (!logs.every(log => log.timestamp.startsWith(date))) throw new Error("Date filter failed");
    console.log("Date filter verified; rows:", logs.length);
    if (logs.length) {
      const workItemId = logs[0].workItemId;
      const filtered = await service.getWorklogs(workItemId, date, date);
      if (!filtered.length || !filtered.every(log => log.workItemId === workItemId)) {
        throw new Error("Work item filter failed");
      }
      console.log("Work item filter verified");
    } else {
      console.log("No entries for the selected date; work item filter not live verified");
    }
  } finally {
    await client.close();
  }
})().catch(() => {
  console.error("Live read probe failed; check configuration and server/API access");
  process.exitCode = 1;
});
