#!/usr/bin/env node
/// <reference path="./types.d.ts" />

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { AxiosInstance } from "axios";

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
  length: number; // API value (minutes or seconds depending on endpoint)
  comment?: string;
  activityTypeId?: string;
}

interface TimeEntry {
  date: string;
  workItemId: number;
  hours: number;
  description: string;
  activityType?: string; // Name or ID
}

type ActivityType = { id: string; name: string };

type WorklogListResponse = { data?: any[]; value?: any[] } | any[];

function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isPositiveNumber(value) && Number.isInteger(value);
}

function isGuidLike(value: string | undefined | null): boolean {
  if (!value) return false;
  // Strict GUID format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return /^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(value);
}

function computeHoursFromApiLength(length: number): number {
  // Heuristic: REST list often returns seconds; create/update uses minutes.
  // If the number is large (>= 1000), assume seconds; else minutes.
  return length >= 1000 ? length / 3600 : length / 60;
}

class SevenPaceService {
  private client: AxiosInstance;
  private config: SevenPaceConfig;
  private activityTypesCache: {
    timestamp: number;
    items: ActivityType[];
  } | null = null;

  public async listActivityTypes(): Promise<ActivityType[]> {
    return this.fetchActivityTypes();
  }

  constructor(config: SevenPaceConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      timeout: 15000, // 15 second timeout for all requests
      validateStatus: (status) => status < 500, // Accept 4xx errors (don't throw)
    });
  }

  private async fetchActivityTypes(): Promise<ActivityType[]> {
    // Cache for 5 minutes
    const now = Date.now();
    if (
      this.activityTypesCache &&
      now - this.activityTypesCache.timestamp < 5 * 60 * 1000
    ) {
      return this.activityTypesCache.items;
    }

    const resp = await this.client.get(
      "/api/rest/activitytypes?api-version=3.2"
    );
    const items: ActivityType[] = Array.isArray(resp.data?.data)
      ? resp.data.data.map((it: any) => ({
          id: it.id ?? it.Id,
          name: it.name ?? it.Name,
        }))
      : Array.isArray(resp.data?.value)
      ? resp.data.value.map((it: any) => ({
          id: it.Id ?? it.id,
          name: it.Name ?? it.name,
        }))
      : [];

    this.activityTypesCache = { timestamp: now, items };
    return items;
  }

  private async resolveActivityTypeId(
    input?: string
  ): Promise<string | undefined> {
    // Helper to resolve a name to ID via API
    const resolveByName = async (name: string): Promise<string | undefined> => {
      try {
        const list = await this.fetchActivityTypes();
        const match = list.find(
          (t) => t.name.toLowerCase() === name.toLowerCase()
        );
        return match?.id;
      } catch {
        return undefined;
      }
    };

    // Only honor explicit input; do not read or use any defaults
    if (input && input.trim().length > 0) {
      if (isGuidLike(input)) return input; // already an ID
      const byName = await resolveByName(input);
      if (byName) return byName;
      return undefined; // invalid input -> omit
    }

    return undefined; // no activity type
  }

  async logTime(entry: TimeEntry): Promise<any> {
    // Check for test credentials
    if (this.config.token === "test-token-replace-with-real-token") {
      throw new McpError(
        ErrorCode.InternalError,
        "Cannot log time with test credentials. Please update .env file with real SEVENPACE_TOKEN and SEVENPACE_ORGANIZATION values."
      );
    }

    const activityTypeId = await this.resolveActivityTypeId(entry.activityType);

    // Build payload matching the working cURL (date, length seconds, billableLength seconds)
    const worklog: any = {
      workItemId: entry.workItemId,
      date: entry.date,
      length: Math.round(entry.hours * 3600),
      billableLength: Math.round(entry.hours * 3600),
      comment: entry.description,
      ...(activityTypeId ? { activityTypeId } : {}),
    };

    try {
      const response = await this.client.post(
        "/api/rest/workLogs?api-version=3.2",
        worklog,
        {
          timeout: Number(process.env.SEVENPACE_WRITE_TIMEOUT_MS) || 30000,
        }
      );

      // Check for API errors even with 2xx status
      if (response.status >= 400) {
        throw new McpError(
          ErrorCode.InternalError,
          `7pace API error (${response.status}): ${
            response.statusText
          } - ${JSON.stringify(response.data)}`
        );
      }

      // Validate that the worklog was actually created
      const responseData = response.data;
      if (!responseData) {
        throw new McpError(
          ErrorCode.InternalError,
          "7pace API returned empty response when creating worklog"
        );
      }

      // If API returns error-like body, surface it
      if (responseData.error || responseData.success === false) {
        throw new McpError(
          ErrorCode.InternalError,
          `7pace API error body: ${JSON.stringify(responseData)}`
        );
      }

      return responseData;
    } catch (error: any) {
      // Handle axios timeout specifically
      if (error?.code === "ECONNABORTED") {
        throw new McpError(
          ErrorCode.InternalError,
          "Request timed out. 7pace API may be slow or unavailable."
        );
      }
      if (error?.response) {
        throw new McpError(
          ErrorCode.InternalError,
          `7pace API error (${error.response.status}): ${
            error.response.statusText
          } - ${JSON.stringify(error.response.data)}`
        );
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to log time: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getWorklogs(
    workItemId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<WorklogEntry[]> {
    // Check for test credentials
    if (this.config.token === "test-token-replace-with-real-token") {
      throw new McpError(
        ErrorCode.InternalError,
        "Cannot retrieve worklogs with test credentials. Please update .env file with real SEVENPACE_TOKEN and SEVENPACE_ORGANIZATION values."
      );
    }

    try {
      const params: any = {};
      if (workItemId) params.workItemId = workItemId;
      if (startDate) params.from = startDate;
      if (endDate) params.to = endDate;

      const response = await this.client.get<WorklogListResponse>(
        "/api/rest/worklogs?api-version=3.2",
        { params }
      );

      const raw = response.data as any;
      let items: any[] = [];

      if (Array.isArray(raw?.data)) {
        items = raw.data;
      } else if (Array.isArray(raw?.value)) {
        // OData shape
        items = raw.value.map((it: any) => ({
          id: it.Id,
          workItemId: it.WorkItemId,
          timestamp: it.Timestamp,
          length: it.Length,
          comment: it.Comment,
        }));
      } else if (Array.isArray(raw)) {
        items = raw;
      }

      return items as WorklogEntry[];
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to retrieve worklogs: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async updateWorklog(
    worklogId: string,
    updates: Partial<TimeEntry>
  ): Promise<any> {
    try {
      const worklog: Partial<WorklogEntry> = {};
      if (typeof updates.hours === "number")
        worklog.length = updates.hours * 3600; // update expects seconds
      if (updates.description) worklog.comment = updates.description;
      if (updates.workItemId) worklog.workItemId = updates.workItemId;

      const response = await this.client.put(
        `/api/rest/worklogs/${worklogId}?api-version=3.2`,
        worklog
      );

      // Check for API errors even with 2xx status
      if (response.status >= 400) {
        throw new McpError(
          ErrorCode.InternalError,
          `7pace API error (${response.status}): ${
            response.statusText
          } - ${JSON.stringify(response.data)}`
        );
      }

      // Validate the response indicates successful update
      const responseData = response.data;
      if (!responseData) {
        throw new McpError(
          ErrorCode.InternalError,
          "7pace API returned empty response - worklog update may have failed"
        );
      }

      // Check for explicit error indicators in response
      if (responseData.error || responseData.success === false) {
        throw new McpError(
          ErrorCode.InternalError,
          `7pace API returned error: ${JSON.stringify(responseData)}`
        );
      }

      return responseData;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update worklog: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async deleteWorklog(worklogId: string): Promise<void> {
    try {
      const response = await this.client.delete(
        `/api/rest/worklogs/${worklogId}?api-version=3.2`
      );

      // Check for API errors even with 2xx status
      if (response.status >= 400) {
        throw new McpError(
          ErrorCode.InternalError,
          `7pace API error (${response.status}): ${
            response.statusText
          } - ${JSON.stringify(response.data)}`
        );
      }

      // For delete operations, some APIs return error information in response body
      const responseData = response.data;
      if (
        responseData &&
        (responseData.error || responseData.success === false)
      ) {
        throw new McpError(
          ErrorCode.InternalError,
          `7pace API returned error: ${JSON.stringify(responseData)}`
        );
      }
    } catch (error) {
      // Re-throw McpError instances as-is
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete worklog: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getTimeReport(
    startDate: string,
    endDate: string,
    userId?: string
  ): Promise<any> {
    try {
      const params: any = {
        "api-version": "3.2",
        from: startDate,
        to: endDate,
      };
      if (userId) params.userId = userId;

      const response = await this.client.get("/api/rest/reports/time", {
        params,
      });
      return response.data;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate time report: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
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
        name: "7pace-timetracker",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize 7pace service with environment variables
    const config: SevenPaceConfig = {
      baseUrl:
        process.env.SEVENPACE_BASE_URL ||
        `https://${process.env.SEVENPACE_ORGANIZATION}.timehub.7pace.com`,
      token: process.env.SEVENPACE_TOKEN || "",
      organizationName: process.env.SEVENPACE_ORGANIZATION || "",
    };

    if (!config.token || !config.organizationName) {
      throw new Error(
        "Missing required environment variables: SEVENPACE_TOKEN and SEVENPACE_ORGANIZATION"
      );
    }

    this.sevenPaceService = new SevenPaceService(config);
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "health",
            description: "Simple health check for deployment scanners",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          {
            name: "log_time",
            description:
              "Log time entry to 7pace Timetracker for a specific work item",
            inputSchema: {
              type: "object",
              properties: {
                workItemId: {
                  type: "number",
                  description: "Azure DevOps Work Item ID",
                },
                date: {
                  type: "string",
                  description: "Date in YYYY-MM-DD format",
                },
                hours: {
                  type: "number",
                  description: "Number of hours worked",
                },
                description: {
                  type: "string",
                  description: "Description of work performed",
                },
                activityType: {
                  type: "string",
                  description: "Type of activity (name or ID, optional)",
                },
              },
              required: ["workItemId", "date", "hours", "description"],
            },
          },
          {
            name: "list_activity_types",
            description: "List available 7pace activity types (name and id)",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          {
            name: "get_worklogs",
            description: "Retrieve time logs from 7pace Timetracker",
            inputSchema: {
              type: "object",
              properties: {
                workItemId: {
                  type: "number",
                  description: "Filter by specific work item ID (optional)",
                },
                startDate: {
                  type: "string",
                  description: "Start date in YYYY-MM-DD format (optional)",
                },
                endDate: {
                  type: "string",
                  description: "End date in YYYY-MM-DD format (optional)",
                },
              },
              required: [],
            },
          },
          {
            name: "update_worklog",
            description: "Update an existing time log entry",
            inputSchema: {
              type: "object",
              properties: {
                worklogId: {
                  type: "string",
                  description: "ID of the worklog to update",
                },
                workItemId: {
                  type: "number",
                  description: "New work item ID (optional)",
                },
                hours: {
                  type: "number",
                  description: "New number of hours (optional)",
                },
                description: {
                  type: "string",
                  description: "New description (optional)",
                },
              },
              required: ["worklogId"],
            },
          },
          {
            name: "delete_worklog",
            description: "Delete a time log entry",
            inputSchema: {
              type: "object",
              properties: {
                worklogId: {
                  type: "string",
                  description: "ID of the worklog to delete",
                },
              },
              required: ["worklogId"],
            },
          },
          {
            name: "generate_time_report",
            description: "Generate time tracking report for a date range",
            inputSchema: {
              type: "object",
              properties: {
                startDate: {
                  type: "string",
                  description: "Start date in YYYY-MM-DD format",
                },
                endDate: {
                  type: "string",
                  description: "End date in YYYY-MM-DD format",
                },
                userId: {
                  type: "string",
                  description: "Filter by specific user ID (optional)",
                },
              },
              required: ["startDate", "endDate"],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "health":
            return {
              content: [
                {
                  type: "text",
                  text: "✅ 7pace MCP server is healthy and reachable",
                },
              ],
            };
          case "log_time":
            return await this.handleLogTime(request.params.arguments);
          case "list_activity_types":
            return await this.handleListActivityTypes();
          case "get_worklogs":
            return await this.handleGetWorklogs(request.params.arguments);
          case "update_worklog":
            return await this.handleUpdateWorklog(request.params.arguments);
          case "delete_worklog":
            return await this.handleDeleteWorklog(request.params.arguments);
          case "generate_time_report":
            return await this.handleGenerateTimeReport(
              request.params.arguments
            );
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

  private async handleLogTime(args: any) {
    // Allow deployment scanners to succeed without credentials or arguments
    if (
      !process.env.SEVENPACE_TOKEN ||
      process.env.SEVENPACE_TOKEN === "test-token-replace-with-real-token"
    ) {
      return {
        content: [
          {
            type: "text",
            text: "✅ 7pace MCP server is reachable (limited mode). Provide SEVENPACE_ORGANIZATION and SEVENPACE_TOKEN to enable time logging.",
          },
        ],
      };
    }

    if (!isPositiveInteger(args.workItemId)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "workItemId must be a positive integer"
      );
    }
    if (!isIsoDateOnly(args.date)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "date must be in YYYY-MM-DD format"
      );
    }
    if (!isPositiveNumber(args.hours)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "hours must be a positive number"
      );
    }
    if (
      typeof args.description !== "string" ||
      args.description.trim().length === 0
    ) {
      throw new McpError(ErrorCode.InvalidParams, "description is required");
    }

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
          type: "text",
          text:
            `✅ Time logged successfully!\n\n` +
            `Work Item: #${entry.workItemId}\n` +
            `Date: ${entry.date}\n` +
            `Hours: ${entry.hours}\n` +
            `Description: ${entry.description}\n` +
            `Worklog ID: ${result.id || result.Id || "N/A"}`,
        },
      ],
    };
  }

  private async handleListActivityTypes() {
    if (
      !process.env.SEVENPACE_TOKEN ||
      process.env.SEVENPACE_TOKEN === "test-token-replace-with-real-token"
    ) {
      return {
        content: [
          {
            type: "text",
            text: "No activity types available in limited mode. Set SEVENPACE_ORGANIZATION and SEVENPACE_TOKEN to enable.",
          },
        ],
      };
    }
    const items = await this.sevenPaceService.listActivityTypes();
    const lines = items.map((t) => `${t.id}  -  ${t.name}`).join("\n");
    return {
      content: [
        {
          type: "text",
          text: lines.length ? lines : "No activity types found",
        },
      ],
    };
  }

  private async handleGetWorklogs(args: any) {
    if (
      !process.env.SEVENPACE_TOKEN ||
      process.env.SEVENPACE_TOKEN === "test-token-replace-with-real-token"
    ) {
      return {
        content: [
          {
            type: "text",
            text: "📄 Worklogs unavailable in limited mode. Provide SEVENPACE_ORGANIZATION and SEVENPACE_TOKEN.",
          },
        ],
      };
    }
    if (args.startDate && !isIsoDateOnly(args.startDate)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "startDate must be in YYYY-MM-DD format"
      );
    }
    if (args.endDate && !isIsoDateOnly(args.endDate)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "endDate must be in YYYY-MM-DD format"
      );
    }
    if (args.startDate && args.endDate && args.startDate > args.endDate) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "startDate must be before or equal to endDate"
      );
    }

    const worklogs = await this.sevenPaceService.getWorklogs(
      args.workItemId,
      args.startDate,
      args.endDate
    );

    const summary = worklogs
      .map((log) => {
        const id = (log as any).id ?? (log as any).Id;
        const workItemId = (log as any).workItemId ?? (log as any).WorkItemId;
        const timestamp = (log as any).timestamp ?? (log as any).Timestamp;
        const length = (log as any).length ?? (log as any).Length;
        const comment =
          (log as any).comment ?? (log as any).Comment ?? "No description";
        const hours =
          typeof length === "number" ? computeHoursFromApiLength(length) : NaN;

        return (
          `📝 Worklog ${id}\n` +
          `   Work Item: #${workItemId}\n` +
          `   Date: ${timestamp}\n` +
          `   Hours: ${Number.isFinite(hours) ? hours.toFixed(2) : "N/A"}\n` +
          `   Description: ${comment}\n`
        );
      })
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `📊 Time Logs (${worklogs.length} entries)\n\n${summary}`,
        },
      ],
    };
  }

  private async handleUpdateWorklog(args: any) {
    if (
      !process.env.SEVENPACE_TOKEN ||
      process.env.SEVENPACE_TOKEN === "test-token-replace-with-real-token"
    ) {
      return {
        content: [
          {
            type: "text",
            text: "✅ Server reachable (limited mode). Provide SEVENPACE_* to enable update_worklog.",
          },
        ],
      };
    }
    if (
      typeof args.worklogId !== "string" ||
      args.worklogId.trim().length === 0
    ) {
      throw new McpError(ErrorCode.InvalidParams, "worklogId is required");
    }
    if (
      typeof args.workItemId === "undefined" &&
      typeof args.hours === "undefined" &&
      typeof args.description === "undefined"
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Provide at least one field to update: workItemId, hours, or description"
      );
    }
    if (
      typeof args.workItemId !== "undefined" &&
      !isPositiveInteger(args.workItemId)
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "workItemId must be a positive integer"
      );
    }
    if (typeof args.hours !== "undefined" && !isPositiveNumber(args.hours)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "hours must be a positive number"
      );
    }

    const updates: Partial<TimeEntry> = {};
    if (typeof args.workItemId !== "undefined")
      updates.workItemId = args.workItemId;
    if (typeof args.hours !== "undefined") updates.hours = args.hours;
    if (typeof args.description !== "undefined")
      updates.description = args.description;

    await this.sevenPaceService.updateWorklog(args.worklogId, updates);

    return {
      content: [
        {
          type: "text",
          text: `✅ Worklog ${args.worklogId} updated successfully!`,
        },
      ],
    };
  }

  private async handleDeleteWorklog(args: any) {
    if (
      !process.env.SEVENPACE_TOKEN ||
      process.env.SEVENPACE_TOKEN === "test-token-replace-with-real-token"
    ) {
      return {
        content: [
          {
            type: "text",
            text: "✅ Server reachable (limited mode). Provide SEVENPACE_* to enable delete_worklog.",
          },
        ],
      };
    }
    if (
      typeof args.worklogId !== "string" ||
      args.worklogId.trim().length === 0
    ) {
      throw new McpError(ErrorCode.InvalidParams, "worklogId is required");
    }

    await this.sevenPaceService.deleteWorklog(args.worklogId);

    return {
      content: [
        {
          type: "text",
          text: `🗑️ Worklog ${args.worklogId} deleted successfully!`,
        },
      ],
    };
  }

  private async handleGenerateTimeReport(args: any) {
    if (
      !process.env.SEVENPACE_TOKEN ||
      process.env.SEVENPACE_TOKEN === "test-token-replace-with-real-token"
    ) {
      return {
        content: [
          {
            type: "text",
            text: "📈 Reports unavailable in limited mode. Provide SEVENPACE_* to enable.",
          },
        ],
      };
    }
    if (!isIsoDateOnly(args.startDate) || !isIsoDateOnly(args.endDate)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Dates must be in YYYY-MM-DD format"
      );
    }
    if (args.startDate > args.endDate) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "startDate must be before or equal to endDate"
      );
    }

    try {
      const report = await this.sevenPaceService.getTimeReport(
        args.startDate,
        args.endDate,
        args.userId
      );

      return {
        content: [
          {
            type: "text",
            text:
              `📈 Time Report (${args.startDate} to ${args.endDate})\n\n` +
              `Total Hours: ${report.totalHours || "N/A"}\n` +
              `Total Entries: ${report.totalEntries || "N/A"}\n` +
              `Report Data: ${JSON.stringify(report, null, 2)}`,
          },
        ],
      };
    } catch {
      // Fallback: compute from worklogs
      const worklogs = await this.sevenPaceService.getWorklogs(
        undefined,
        args.startDate,
        args.endDate
      );
      const totals = worklogs.reduce(
        (acc, wl) => {
          const len = (wl as any).length ?? (wl as any).Length;
          const hours =
            typeof len === "number" ? computeHoursFromApiLength(len) : 0;
          acc.totalHours += hours;
          acc.totalEntries += 1;
          return acc;
        },
        { totalHours: 0, totalEntries: 0 }
      );

      return {
        content: [
          {
            type: "text",
            text:
              `📈 Time Report (${args.startDate} to ${args.endDate}) [computed]\n\n` +
              `Total Hours: ${totals.totalHours.toFixed(2)}\n` +
              `Total Entries: ${totals.totalEntries}`,
          },
        ],
      };
    }
  }

  async run() {
    // If PORT is provided, start HTTP mode per Smithery container requirements
    const port = process.env.PORT ? Number(process.env.PORT) : undefined;
    if (port) {
      const app = express();
      app.use(cors());
      app.use(express.json());
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await this.server.connect(transport as any);

      // Fail fast if explicitly requested and required config is missing or placeholder
      const failFast =
        String(process.env.FAIL_FAST || "").toLowerCase() === "true" ||
        String(process.env.REQUIRE_CONFIG_ON_START || "").toLowerCase() ===
          "true";
      const hasValidCreds =
        !!process.env.SEVENPACE_ORGANIZATION &&
        !!process.env.SEVENPACE_TOKEN &&
        process.env.SEVENPACE_TOKEN !== "test-token-replace-with-real-token";
      if (failFast && !hasValidCreds) {
        console.error(
          "[startup] Missing or invalid SEVENPACE_* config and FAIL_FAST is enabled. Exiting."
        );
        process.exit(1);
      }

      // Optional scan timeout to avoid long hangs during deployment scans
      const scanTimeoutSeconds = Number(process.env.SCAN_TIMEOUT_SECONDS || 0);
      let scanTimer: ReturnType<typeof setTimeout> | null = null;
      if (scanTimeoutSeconds > 0) {
        scanTimer = setTimeout(() => {
          console.error(
            `[startup] No /mcp activity within ${scanTimeoutSeconds}s. Exiting to fail fast.`
          );
          process.exit(1);
        }, scanTimeoutSeconds * 1000);
      }
      const markActivity = () => {
        if (scanTimer) {
          clearTimeout(scanTimer);
          scanTimer = null;
        }
      };

      const applyConfigFromQuery = (q: any) => {
        if (!q) return;
        const setIf = (key: string, envKey: string) => {
          const v = (q as any)[key];
          if (typeof v === "string" && v.length > 0) process.env[envKey] = v;
        };
        setIf("sevenpaceOrganization", "SEVENPACE_ORGANIZATION");
        setIf("sevenpaceToken", "SEVENPACE_TOKEN");
        setIf("azureDevopsOrgUrl", "AZURE_DEVOPS_ORG_URL");
        setIf("azureDevopsPat", "AZURE_DEVOPS_PAT");
        setIf("timeZone", "TZ");
        setIf("logLevel", "LOG_LEVEL");
      };

      app.post("/mcp", (req: any, res: any) => {
        try {
          applyConfigFromQuery(req.query);
        } catch {}
        markActivity();
        transport.handleRequest(req, res, req.body).catch((err: any) => {
          console.error("HTTP transport error:", err);
          if (!res.headersSent)
            res.status(500).json({ error: "Internal Server Error" });
        });
      });
      app.options("/mcp", cors(), (_req: any, res: any) => {
        markActivity();
        res.sendStatus(204);
      });
      app.get("/mcp", (_req: any, res: any) => {
        markActivity();
        res.status(200).send("OK");
      });
      app.delete("/mcp", (_req: any, res: any) => {
        markActivity();
        res.status(200).send("OK");
      });
      app.get("/", (_req: any, res: any) => {
        markActivity();
        res.status(200).send("OK");
      });
      app.listen(port, () => {
        console.error(`7pace MCP server (HTTP) on :${port} /mcp`);
      });
      return;
    }

    // Fallback to stdio when no PORT is present
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("7pace Timetracker MCP server running on stdio");
  }
}

// Start the server
if (require.main === module) {
  const server = new SevenPaceMCPServer();
  server.run().catch(console.error);
}

export { SevenPaceMCPServer, SevenPaceService };
