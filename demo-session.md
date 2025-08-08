# 7pace MCP Server Demo Session

## Real-World Usage Scenarios

Once you have your 7pace token configured, here's exactly how your time tracking workflow will work:

### Scenario 1: Logging Time for Work Item 7128

**You say to Cursor:**
> "I spent 2 hours yesterday investigating the multi-company tabs architecture. The NFE team said it's not feasible with current architecture, so I need to research session management alternatives. Log this against work item 7128."

**What happens:**
1. Cursor understands this is a time logging request
2. Calls the `log_time` tool with:
   ```json
   {
     "workItemId": 7128,
     "date": "2025-01-07", 
     "hours": 2,
     "description": "Multi-company tabs architecture investigation - NFE feasibility analysis, researching session management alternatives"
   }
   ```
3. You get confirmation: ✅ Time logged successfully!

### Scenario 2: Weekly DevOps Task Time Logging

**You say to Cursor:**
> "Log my DevOps work for this week: Monday I did 2 hours of pipeline investigation on task 7375, Tuesday 1.5 hours of PR reviews on 7376, and Wednesday 3 hours of security audit on 7377."

**What happens:**
1. Cursor processes this as multiple time entries
2. Calls `log_time` three times automatically
3. All three entries are logged in 7pace
4. You get a summary of all logged time

### Scenario 3: Time Tracking Reports

**You say to Cursor:**
> "Show me how much time I've spent on the multi-company tabs project this month"

**What happens:**
1. Calls `get_worklogs` with work item 7128 filter
2. Shows you all time entries for that work item
3. Calculates total hours spent
4. Gives you insights on time distribution

### Scenario 4: Time Entry Corrections

**You say to Cursor:**
> "I made a mistake on my last time entry. It should be 4 hours instead of 2, and the description should mention sessions architecture instead of just investigation."

**What happens:**
1. Cursor retrieves your recent worklog entries
2. Identifies the entry to update
3. Calls `update_worklog` with new values
4. Confirms the update

## Integration with Your Current Work

### Work Item 7128: Multi-company Tabs
- **Current Status**: BLOCKED - NFE says not feasible
- **Time Logged**: 2 hours investigation (yesterday)
- **Estimate**: 60 hours total, 58 remaining
- **Next**: "Schedule sessions with NFE team to discuss alternative solutions"

**Time logging commands:**
```
"Log time for NFE collaboration session on 7128"
"Log architecture research time on multi-company tabs"
"Log session management investigation for work item 7128"
```

### Frontend DevOps Tasks (7375, 7376, 7377)
- **Task 7375**: Pipeline Health Audit (16 hours estimated)
- **Task 7376**: Pull Request Review (8 hours estimated)  
- **Task 7377**: Security Audit (12 hours estimated)

**Time logging commands:**
```
"Log pipeline investigation time on 7375"
"Log PR review work on 7376" 
"Log security audit work on 7377"
```

## Natural Language Examples

The MCP server understands various ways of expressing time logging:

### Different Ways to Say the Same Thing:
- "Log 2 hours on 7128 for architecture work"
- "I spent 2 hours working on work item 7128 doing architecture investigation"
- "Track 2 hours against ticket 7128 for multi-company tabs research"
- "Record 2 hours of time on task 7128 for architecture analysis"

### Time Queries:
- "How much time have I logged this week?"
- "Show me my time entries for work item 7128"
- "What's my total time on DevOps tasks this month?"
- "Generate a time report for last week"

### Time Management:
- "Update my last time entry to 3 hours"
- "Delete the time entry I just created"
- "Change the description on my recent 7128 entry"

## Benefits You'll Experience

1. **No Context Switching**: Stay in Cursor, don't open 7pace UI
2. **Natural Language**: Just describe what you did
3. **Work Item Integration**: Automatic linking to Azure DevOps
4. **Batch Operations**: Log multiple entries at once
5. **Smart Corrections**: Easy to fix mistakes
6. **Reporting**: Get insights without manual queries

## Ready to Start!

Your MCP server is built, tested, and ready. Just need to:
1. Get your 7pace API token from Azure DevOps
2. Update the `.env` file  
3. Add to Cursor MCP configuration
4. Start time tracking with natural language! 🚀
