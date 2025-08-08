#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';

// 7pace Timetracker MCP Server
// Integrates with 7pace API for time tracking in Azure DevOps

interface SevenPaceConfig {
  baseUrl: string;
  token: string;
  organizationName: string;
}

interface WorklogEntry {
  id?: string;
  workItemId: number;
  timestamp: string;
  length: number; // in minutes
  comment?: string;
  activityTypeId?: string;
}

interface TimeEntry {
  date: string;
  workItemId: number;
  hours: number;
  description: string;
  activityType?: string;
}

class SevenPaceService {
  private client: AxiosInstance;
  private config: SevenPaceConfig;

  constructor(config: SevenPaceConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async logTime(entry: TimeEntry): Promise<any> {
    const worklog: WorklogEntry = {
      workItemId: entry.workItemId,
      timestamp: `${entry.date}T00:00:00`,
      length: entry.hours * 60, // 7pace accepts minutes; existing data reads seconds but minutes are accepted for create
      comment: entry.description,
      ...(process.env.SEVENPACE_DEFAULT_ACTIVITY_TYPE_ID
        ? { activityTypeId: process.env.SEVENPACE_DEFAULT_ACTIVITY_TYPE_ID }
        : {}),
    };

    try {
      const response = await this.client.post('/api/rest/worklogs?api-version=3.2', worklog);
      return response.data;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to log time: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getWorklogs(workItemId?: number, startDate?: string, endDate?: string): Promise<any[]> {
    try {
      const params: any = {};
      if (workItemId) params.workItemId = workItemId;
      if (startDate) params.from = startDate;
      if (endDate) params.to = endDate;

      const response = await this.client.get('/api/rest/worklogs?api-version=3.2', { params });
      return response.data;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to retrieve worklogs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async updateWorklog(worklogId: string, updates: Partial<TimeEntry>): Promise<any> {
    try {
      const worklog: Partial<WorklogEntry> = {};
      if (updates.hours) worklog.length = updates.hours * 60;
      if (updates.description) worklog.comment = updates.description;
      if (updates.workItemId) worklog.workItemId = updates.workItemId;

      const response = await this.client.put(`/api/rest/worklogs/${worklogId}?api-version=3.2`, worklog);
      return response.data;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update worklog: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async deleteWorklog(worklogId: string): Promise<void> {
    try {
      await this.client.delete(`/api/rest/worklogs/${worklogId}?api-version=3.2`);
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete worklog: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getTimeReport(startDate: string, endDate: string, userId?: string): Promise<any> {
    try {
      const params: any = {
        'api-version': '3.2',
        from: startDate,
        to: endDate,
      };
      if (userId) params.userId = userId;

      const response = await this.client.get('/api/rest/reports/time', { params });
      return response.data;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate time report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

class SevenPaceMCPServer {
  private server: Server;
  private sevenPaceService: SevenPaceService;

  constructor() {
    this.server = new Server(
      {
        name: '7pace-timetracker',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize 7pace service with environment variables
    const config: SevenPaceConfig = {
      baseUrl: process.env.SEVENPACE_BASE_URL || `https://${process.env.SEVENPACE_ORGANIZATION}.timehub.7pace.com`,
      token: process.env.SEVENPACE_TOKEN || '',
      organizationName: process.env.SEVENPACE_ORGANIZATION || '',
    };

    if (!config.token || !config.organizationName) {
      throw new Error('Missing required environment variables: SEVENPACE_TOKEN and SEVENPACE_ORGANIZATION');
    }

    this.sevenPaceService = new SevenPaceService(config);
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'log_time',
            description: 'Log time entry to 7pace Timetracker for a specific work item',
            inputSchema: {
              type: 'object',
              properties: {
                workItemId: {
                  type: 'number',
                  description: 'Azure DevOps Work Item ID',
                },
                date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format',
                },
                hours: {
                  type: 'number',
                  description: 'Number of hours worked',
                },
                description: {
                  type: 'string',
                  description: 'Description of work performed',
                },
                activityType: {
                  type: 'string',
                  description: 'Type of activity (optional)',
                },
              },
              required: ['workItemId', 'date', 'hours', 'description'],
            },
          },
          {
            name: 'get_worklogs',
            description: 'Retrieve time logs from 7pace Timetracker',
            inputSchema: {
              type: 'object',
              properties: {
                workItemId: {
                  type: 'number',
                  description: 'Filter by specific work item ID (optional)',
                },
                startDate: {
                  type: 'string',
                  description: 'Start date in YYYY-MM-DD format (optional)',
                },
                endDate: {
                  type: 'string',
                  description: 'End date in YYYY-MM-DD format (optional)',
                },
              },
              required: [],
            },
          },
          {
            name: 'update_worklog',
            description: 'Update an existing time log entry',
            inputSchema: {
              type: 'object',
              properties: {
                worklogId: {
                  type: 'string',
                  description: 'ID of the worklog to update',
                },
                workItemId: {
                  type: 'number',
                  description: 'New work item ID (optional)',
                },
                hours: {
                  type: 'number',
                  description: 'New number of hours (optional)',
                },
                description: {
                  type: 'string',
                  description: 'New description (optional)',
                },
              },
              required: ['worklogId'],
            },
          },
          {
            name: 'delete_worklog',
            description: 'Delete a time log entry',
            inputSchema: {
              type: 'object',
              properties: {
                worklogId: {
                  type: 'string',
                  description: 'ID of the worklog to delete',
                },
              },
              required: ['worklogId'],
            },
          },
          {
            name: 'generate_time_report',
            description: 'Generate time tracking report for a date range',
            inputSchema: {
              type: 'object',
              properties: {
                startDate: {
                  type: 'string',
                  description: 'Start date in YYYY-MM-DD format',
                },
                endDate: {
                  type: 'string',
                  description: 'End date in YYYY-MM-DD format',
                },
                userId: {
                  type: 'string',
                  description: 'Filter by specific user ID (optional)',
                },
              },
              required: ['startDate', 'endDate'],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'log_time':
            return await this.handleLogTime(request.params.arguments);
          case 'get_worklogs':
            return await this.handleGetWorklogs(request.params.arguments);
          case 'update_worklog':
            return await this.handleUpdateWorklog(request.params.arguments);
          case 'delete_worklog':
            return await this.handleDeleteWorklog(request.params.arguments);
          case 'generate_time_report':
            return await this.handleGenerateTimeReport(request.params.arguments);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
      }
    });
  }

  private async handleLogTime(args: any) {
    const entry: TimeEntry = {
      workItemId: args.workItemId,
      date: args.date,
      hours: args.hours,
      description: args.description,
      activityType: args.activityType,
    };

    const result = await this.sevenPaceService.logTime(entry);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Time logged successfully!\n\n` +
                `Work Item: #${entry.workItemId}\n` +
                `Date: ${entry.date}\n` +
                `Hours: ${entry.hours}\n` +
                `Description: ${entry.description}\n` +
                `Worklog ID: ${result.id || 'N/A'}`,
        },
      ],
    };
  }

  private async handleGetWorklogs(args: any) {
    const worklogs = await this.sevenPaceService.getWorklogs(
      args.workItemId,
      args.startDate,
      args.endDate
    );

    const summary = worklogs.map(log =>
      `📝 Worklog ${log.id}\n` +
      `   Work Item: #${log.workItemId}\n` +
      `   Date: ${log.timestamp}\n` +
      `   Hours: ${(log.length / 60).toFixed(2)}\n` +
      `   Description: ${log.comment || 'No description'}\n`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `📊 Time Logs (${worklogs.length} entries)\n\n${summary}`,
        },
      ],
    };
  }

  private async handleUpdateWorklog(args: any) {
    const updates: Partial<TimeEntry> = {};
    if (args.workItemId) updates.workItemId = args.workItemId;
    if (args.hours) updates.hours = args.hours;
    if (args.description) updates.description = args.description;

    const result = await this.sevenPaceService.updateWorklog(args.worklogId, updates);

    return {
      content: [
        {
          type: 'text',
          text: `✅ Worklog ${args.worklogId} updated successfully!`,
        },
      ],
    };
  }

  private async handleDeleteWorklog(args: any) {
    await this.sevenPaceService.deleteWorklog(args.worklogId);

    return {
      content: [
        {
          type: 'text',
          text: `🗑️ Worklog ${args.worklogId} deleted successfully!`,
        },
      ],
    };
  }

  private async handleGenerateTimeReport(args: any) {
    const report = await this.sevenPaceService.getTimeReport(
      args.startDate,
      args.endDate,
      args.userId
    );

    return {
      content: [
        {
          type: 'text',
          text: `📈 Time Report (${args.startDate} to ${args.endDate})\n\n` +
                `Total Hours: ${report.totalHours || 'N/A'}\n` +
                `Total Entries: ${report.totalEntries || 'N/A'}\n` +
                `Report Data: ${JSON.stringify(report, null, 2)}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('7pace Timetracker MCP server running on stdio');
  }
}

// Start the server
if (require.main === module) {
  const server = new SevenPaceMCPServer();
  server.run().catch(console.error);
}

export { SevenPaceMCPServer, SevenPaceService };
