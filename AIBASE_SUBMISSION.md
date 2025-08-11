# 7pace Timetracker MCP

Professional 7pace Timetracker integration for Azure DevOps via MCP. Natural-language time tracking with zero context switching.

- NPM: https://www.npmjs.com/package/7pace-mcp-server
- Repo: https://github.com/turnono/7pace-mcp-server
- Homepage: https://7pace-mcp.web.app
- Smithery: https://smithery.ai/server/@turnono/sevenpace-mcp-server

## Install

Smithery (recommended):

```bash
npx -y @smithery/cli install @turnono/sevenpace-mcp-server --client claude
```

Direct:

```bash
npx -y github:turnono/7pace-mcp-server
```

## Configure

Required env:

```bash
SEVENPACE_ORGANIZATION=your-org
SEVENPACE_TOKEN=***
```

Optional:

```bash
SEVENPACE_WRITE_TIMEOUT_MS=45000
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-org
AZURE_DEVOPS_PAT=***
```

## MCP Tools

- log_time(workItemId, date, hours, description, activityType?)
- get_worklogs(workItemId?, startDate?, endDate?)
- update_worklog(worklogId, hours?, description?, workItemId?)
- delete_worklog(worklogId)
- generate_time_report(startDate, endDate, userId?)
- list_activity_types()

## Icon

See `public/icon.svg`.
