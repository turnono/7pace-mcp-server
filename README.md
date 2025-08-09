# 7pace Timetracker MCP Server

A Model Context Protocol (MCP) server that integrates with 7pace Timetracker for Azure DevOps time tracking functionality.

## Features

- **Log Time**: Record time entries against work items
- **Retrieve Time Logs**: Query existing time entries with filters
- **Update Time Logs**: Modify existing time entries
- **Delete Time Logs**: Remove time entries
- **Generate Reports**: Create time tracking reports for date ranges
- **Activity Type Resolution**: Provide activity type by name or ID (with optional default via env)

## Prerequisites

- Node.js 18+
- 7pace Timetracker enabled in Azure DevOps
- 7pace API token
- Azure DevOps Personal Access Token (PAT)

## Installation

1. **Clone and install**:

   ```bash
   cd mcp-servers/7pace-mcp-server
   npm install
   npm run build
   ```

2. **Configure environment variables**:

   ```bash
   cp env.example .env
   # Edit .env with your actual values
   ```

3. **Set up environment**:

   ```bash
   # Required
   export SEVENPACE_ORGANIZATION="labournet"
   export SEVENPACE_TOKEN="your_7pace_api_token"

   # Optional
   export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/labournet"
   export AZURE_DEVOPS_PAT="your_azure_devops_pat"
   # Optional default activity type ID (used when not provided or when name cannot be resolved)
   export SEVENPACE_DEFAULT_ACTIVITY_TYPE_ID="your_activity_type_id"
   ```

## Usage

### Standalone Mode

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

### MCP Integration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "7pace-timetracker": {
      "command": "node",
      "args": ["/path/to/7pace-mcp-server/dist/index.js"],
      "env": {
        "SEVENPACE_ORGANIZATION": "labournet",
        "SEVENPACE_TOKEN": "your_7pace_api_token"
      }
    }
  }
}
```

### Cursor / VS Code via NPX (no clone)

Use NPX to install from GitHub and run locally (stdio transport):

```json
{
  "mcpServers": {
    "7pace-timetracker": {
      "command": "npx",
      "args": ["-y", "github:turnono/7pace-mcp-server"],
      "env": {
        "SEVENPACE_ORGANIZATION": "your-org",
        "SEVENPACE_TOKEN": "your-token",
        "SEVENPACE_DEFAULT_ACTIVITY_TYPE_ID": "optional-id"
      }
    }
  }
}
```

VS Code workspace config (`.vscode/mcp.json`):

```json
{
  "servers": {
    "7pace-timetracker": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:turnono/7pace-mcp-server"],
      "env": {
        "SEVENPACE_ORGANIZATION": "your-org",
        "SEVENPACE_TOKEN": "your-token",
        "SEVENPACE_DEFAULT_ACTIVITY_TYPE_ID": "optional-id"
      },
      "version": "1.0.0"
    }
  }
}
```

Notes:

- Requires Node.js 18+ on the local machine
- This server uses stdio; run locally (do not deploy to cloud HTTP)
- After adding, restart Cursor/VS Code

## API Tools

### log_time

Log time entry for a work item.

**Parameters:**

- `workItemId` (number): Azure DevOps Work Item ID
- `date` (string): Date in YYYY-MM-DD format
- `hours` (number): Hours worked
- `description` (string): Work description
- `activityType` (string, optional): Type of activity

Notes:

- `activityType` can be a name (resolved against 7pace Activity Types) or an ID. If not provided or not resolvable, the server will use `SEVENPACE_DEFAULT_ACTIVITY_TYPE_ID` if set.
- Validation enforced: `workItemId` must be a positive integer, `hours` positive number, `date` must be `YYYY-MM-DD`.

**Example:**

```
Log 2 hours on work item 7128 for yesterday with description "Multi-company tabs architecture investigation"
```

### get_worklogs

Retrieve time entries with optional filters.

**Parameters:**

- `workItemId` (number, optional): Filter by work item
- `startDate` (string, optional): Start date filter
- `endDate` (string, optional): End date filter

Notes:

- Handles both REST (`{ data: [...] }`) and OData (`{ value: [...] }`) response shapes.
- Normalizes displayed hours whether API returns minutes or seconds.

### update_worklog

Update an existing time entry.

**Parameters:**

- `worklogId` (string): ID of worklog to update
- `workItemId` (number, optional): New work item ID
- `hours` (number, optional): New hours
- `description` (string, optional): New description

Notes:

- At least one of `workItemId`, `hours`, or `description` must be provided.

### delete_worklog

Delete a time entry.

**Parameters:**

- `worklogId` (string): ID of worklog to delete

### generate_time_report

Generate time tracking report.

**Parameters:**

- `startDate` (string): Start date in YYYY-MM-DD format
- `endDate` (string): End date in YYYY-MM-DD format
- `userId` (string, optional): Filter by user

Notes:

- If the 7pace report endpoint is unavailable, a fallback report is computed from fetched worklogs (total hours and entries).

## 7pace API Token Setup

1. Go to Azure DevOps → 7pace Timetracker
2. Navigate to Settings → API & Reporting
3. Click "Create New Token"
4. Copy and use in `SEVENPACE_TOKEN` environment variable

## Integration with Azure DevOps

This MCP server works seamlessly with Azure DevOps work items. You can:

- Track time against any work item ID
- Link time entries to specific tasks, bugs, user stories
- Generate reports for sprint planning and billing
- Integrate with existing Azure DevOps workflows

## Error Handling

The server provides detailed error messages for:

- Authentication failures
- Invalid work item IDs
- Network connectivity issues
- Missing required parameters
- Invalid date format or negative/zero hours

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

**Authentication Issues:**

- Verify 7pace token is valid and has necessary permissions
- Check organization name matches your 7pace URL

**Connection Issues:**

- Ensure 7pace service is accessible
- Verify Azure DevOps organization URL is correct

**Work Item Issues:**

- Confirm work item exists and you have access
- Check work item ID is numeric

## License

MIT - See LICENSE file for details.
