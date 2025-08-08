# 7pace MCP Server Usage Examples

## Setup Example

First, get your 7pace API token and configure the environment:

```bash
# Set up environment variables
export SEVENPACE_ORGANIZATION="labournet"
export SEVENPACE_TOKEN="your_actual_7pace_token"
export AZURE_DEVOPS_ORG_URL="https://dev.azure.com/labournet"
export AZURE_DEVOPS_PAT="your_azure_devops_pat"

# Start the MCP server
npm start
```

## Usage Examples

### 1. Log Time for Work Item 7128 (Multi-company tabs investigation)

**Prompt:**
> "Log 2 hours on work item 7128 for yesterday with description 'Multi-company tabs architecture investigation - NFE feasibility analysis'"

**Tool Call:**
```json
{
  "tool": "log_time",
  "arguments": {
    "workItemId": 7128,
    "date": "2025-01-07",
    "hours": 2,
    "description": "Multi-company tabs architecture investigation - NFE feasibility analysis",
    "activityType": "Investigation"
  }
}
```

### 2. Log Time for Frontend DevOps Tasks

**Prompt:**
> "Log 3 hours today on task 7375 for pipeline investigation work"

**Tool Call:**
```json
{
  "tool": "log_time",
  "arguments": {
    "workItemId": 7375,
    "date": "2025-01-08",
    "hours": 3,
    "description": "Frontend DevOps: Pipeline Health Audit - investigating build failures"
  }
}
```

### 3. Get All Time Logs for Last Week

**Prompt:**
> "Show me all time logs from January 1st to 7th, 2025"

**Tool Call:**
```json
{
  "tool": "get_worklogs",
  "arguments": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-07"
  }
}
```

### 4. Get Time Logs for Specific Work Item

**Prompt:**
> "Show me all time entries for work item 7128"

**Tool Call:**
```json
{
  "tool": "get_worklogs",
  "arguments": {
    "workItemId": 7128
  }
}
```

### 5. Update a Time Log Entry

**Prompt:**
> "Update worklog 123456 to 4 hours with description 'Extended investigation into sessions architecture'"

**Tool Call:**
```json
{
  "tool": "update_worklog",
  "arguments": {
    "worklogId": "123456",
    "hours": 4,
    "description": "Extended investigation into sessions architecture"
  }
}
```

### 6. Generate Weekly Time Report

**Prompt:**
> "Generate a time report for this week (January 6-12, 2025)"

**Tool Call:**
```json
{
  "tool": "generate_time_report",
  "arguments": {
    "startDate": "2025-01-06",
    "endDate": "2025-01-12"
  }
}
```

### 7. Batch Time Logging (Multiple Entries)

**Prompt:**
> "Log the following time entries:
> - 2 hours on 7375 for Monday: Pipeline investigation  
> - 1.5 hours on 7376 for Tuesday: PR reviews
> - 3 hours on 7377 for Wednesday: Security audit"

This would trigger multiple `log_time` calls:

```json
[
  {
    "tool": "log_time",
    "arguments": {
      "workItemId": 7375,
      "date": "2025-01-06",
      "hours": 2,
      "description": "Frontend DevOps: Pipeline investigation"
    }
  },
  {
    "tool": "log_time", 
    "arguments": {
      "workItemId": 7376,
      "date": "2025-01-07",
      "hours": 1.5,
      "description": "Frontend DevOps: PR reviews"
    }
  },
  {
    "tool": "log_time",
    "arguments": {
      "workItemId": 7377,
      "date": "2025-01-08", 
      "hours": 3,
      "description": "Frontend DevOps: Security audit"
    }
  }
]
```

## Integration with Azure DevOps MCP

When combined with Azure DevOps MCP server, you can do powerful workflows:

### Example: Work Item + Time Tracking Workflow

**Prompt:**
> "Show me details for work item 7128, then log 2 hours of work on it"

This would:
1. Use Azure DevOps MCP to get work item details
2. Use 7pace MCP to log time against that work item

### Example: Create Work Item + Log Time

**Prompt:**
> "Create a new task for 'Fix login bug' and log 1 hour of investigation time"

This would:
1. Use Azure DevOps MCP to create the work item
2. Get the new work item ID
3. Use 7pace MCP to log time against the new work item

## Natural Language Examples

The MCP server understands natural language through the AI assistant:

- "Log 2 hours yesterday on the multi-company tabs ticket"
- "How much time did I spend on DevOps tasks this week?"
- "Update my last time entry to 3 hours instead of 2"
- "Delete the time entry I just created"
- "Show me my time report for last month"

## Error Handling Examples

**Invalid Work Item:**
```
❌ Error: Work item 99999 not found or access denied
```

**Missing Token:**
```  
❌ Error: 7pace authentication failed. Check SEVENPACE_TOKEN environment variable
```

**Invalid Date Format:**
```
❌ Error: Date must be in YYYY-MM-DD format (received: "Jan 8, 2025")
```

## Best Practices

1. **Use descriptive comments**: Include enough detail for future reference
2. **Log daily**: Don't wait until end of week to log time
3. **Be accurate**: Round to nearest 15-minute increment
4. **Use consistent activity types**: Helps with reporting and analysis
5. **Link to work items**: Always associate time with specific work items
