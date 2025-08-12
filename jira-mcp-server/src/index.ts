#!/usr/bin/env node

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { JiraService, JiraConfig } from "./service.js";

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

class JiraMCPServer {
  private server: Server;
  private jiraService: JiraService;

  constructor() {
    this.server = new Server(
      {
        name: "jira-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    const config: JiraConfig = {
      baseUrl: process.env.JIRA_BASE_URL || "",
      email: process.env.JIRA_EMAIL || "",
      apiToken: process.env.JIRA_API_TOKEN || "",
    };

    if (!config.baseUrl || !config.email || !config.apiToken) {
      throw new Error(
        "Missing required environment variables: JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN"
      );
    }

    this.jiraService = new JiraService(config);
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_issue",
            description: "Get details for a Jira issue",
            inputSchema: {
              type: "object",
              properties: {
                issueIdOrKey: {
                  type: "string",
                  description: "The ID or key of the Jira issue (e.g., 'PROJ-123')",
                },
              },
              required: ["issueIdOrKey"],
            },
          },
          {
            name: "log_work",
            description: "Log work/time on a Jira issue",
            inputSchema: {
              type: "object",
              properties: {
                issueIdOrKey: {
                  type: "string",
                  description: "The ID or key of the Jira issue (e.g., 'PROJ-123')",
                },
                hours: {
                  type: "number",
                  description: "The number of hours to log",
                },
                comment: {
                  type: "string",
                  description: "A comment to add to the worklog",
                },
              },
              required: ["issueIdOrKey", "hours", "comment"],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "get_issue":
            return await this.handleGetIssue(request.params.arguments);
          case "log_work":
            return await this.handleLogWork(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    });
  }

  private async handleGetIssue(args: any) {
    if (typeof args.issueIdOrKey !== "string" || args.issueIdOrKey.trim().length === 0) {
      throw new McpError(ErrorCode.InvalidParams, "issueIdOrKey must be a non-empty string");
    }

    const issue = await this.jiraService.getIssue(args.issueIdOrKey);

    return {
      content: [
        {
          type: "text",
          text:
            `Jira Issue: ${issue.key}\n` +
            `Summary: ${issue.fields.summary}\n` +
            `Status: ${issue.fields.status.name}\n` +
            `Description: ${issue.fields.description || "No description."}`,
        },
      ],
    };
  }

  private async handleLogWork(args: any) {
    if (typeof args.issueIdOrKey !== "string" || args.issueIdOrKey.trim().length === 0) {
      throw new McpError(ErrorCode.InvalidParams, "issueIdOrKey must be a non-empty string");
    }
    if (!isPositiveNumber(args.hours)) {
      throw new McpError(ErrorCode.InvalidParams, "hours must be a positive number");
    }
    if (typeof args.comment !== "string" || args.comment.trim().length === 0) {
        throw new McpError(ErrorCode.InvalidParams, "comment must be a non-empty string");
    }

    const timeSpentSeconds = Math.round(args.hours * 3600);
    await this.jiraService.logWork(args.issueIdOrKey, timeSpentSeconds, args.comment);

    return {
      content: [
        {
          type: "text",
          text: `✅ Successfully logged ${args.hours} hours on issue ${args.issueIdOrKey}.`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Jira MCP server running on stdio");
  }
}

if (require.main === module) {
  const server = new JiraMCPServer();
  server.run().catch(console.error);
}

export { JiraMCPServer };
