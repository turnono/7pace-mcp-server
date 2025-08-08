# Setting up 7pace MCP Server in Cursor

## 🎯 Quick Setup Steps

### 1. Get Your 7pace API Token

1. **Open Azure DevOps**: https://dev.azure.com/labournet/Technology
2. **Click "7pace Timetracker"** in the left sidebar
3. **Navigate to**: Settings → API & Reporting → API Settings  
4. **Click "Create New Token"**
5. **Copy the generated token** (it looks like: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...`)

### 2. Update Your .env File

```bash
# Edit the .env file in this directory
SEVENPACE_ORGANIZATION=labournet
SEVENPACE_TOKEN=your_actual_token_here
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/labournet
```

### 3. Add to Cursor MCP Configuration

In your Cursor settings, add this MCP configuration:

```json
{
  "mcpServers": {
    "7pace-timetracker": {
      "command": "node",
      "args": ["./mcp-servers/7pace-mcp-server/dist/index.js"],
      "cwd": "C:/Users/aabrahams.adm1/Documents/workspace/labournet-angular-nx",
      "env": {
        "SEVENPACE_ORGANIZATION": "labournet",
        "SEVENPACE_TOKEN": "your_actual_7pace_token_here"
      }
    }
  }
}
```

### 4. Test Your Setup

Once configured, you can use natural language with Cursor:

**Example Commands:**
- "Log 2 hours on work item 7128 for yesterday with description 'Multi-company tabs architecture investigation'"
- "Show me all my time logs for this week"
- "Log 3 hours today on task 7375 for pipeline investigation work"
- "Generate a time report for January 1-7, 2025"

## 🔍 Troubleshooting

**If the server doesn't start:**
- Check that Node.js is installed: `node --version`
- Verify the build completed: `npm run build`
- Check the .env file has correct values

**If 7pace authentication fails:**
- Verify your token is valid and not expired
- Check organization name matches your 7pace URL
- Ensure you have permissions in 7pace

**If work items aren't found:**
- Verify the work item ID exists in Azure DevOps
- Check you have access to the work item
- Ensure work item ID is numeric

## 🎮 Ready-to-Use Examples

Based on your current work items:

### Work Item 7128 (Multi-company tabs)
```
"Log 2 hours on work item 7128 for architecture investigation"
```

### DevOps Tasks (7375, 7376, 7377)
```
"Log 1.5 hours on task 7375 for pipeline health audit"
"Log 2 hours on task 7376 for PR review and triage"  
"Log 3 hours on task 7377 for security audit work"
```

### Time Management
```
"Show me all time entries for work item 7128"
"Generate my time report for this week"
"Update my last time entry to 4 hours"
```

The MCP server is **production-ready** and tested! 🚀
