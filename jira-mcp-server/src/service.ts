import axios, { AxiosInstance } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// Basic interfaces for Jira data.
// These can be expanded based on the properties needed.
interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string;
    status: {
      name: string;
    };
  };
}

interface JiraWorklog {
  comment: string;
  started: string;
  timeSpentSeconds: number;
}

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export class JiraService {
  private client: AxiosInstance;

  constructor(config: JiraConfig) {
    if (!config.baseUrl || !config.email || !config.apiToken) {
      throw new Error("Jira config requires baseUrl, email, and apiToken.");
    }

    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.email}:${config.apiToken}`
        ).toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    });
  }

  async getIssue(issueIdOrKey: string): Promise<JiraIssue> {
    try {
      const response = await this.client.get(`/rest/api/3/issue/${issueIdOrKey}`);
      return response.data as JiraIssue;
    } catch (error: any) {
      if (error.response) {
        throw new McpError(
          ErrorCode.InternalError,
          `Jira API error (${error.response.status}): ${JSON.stringify(error.response.data)}`
        );
      }
      throw new McpError(ErrorCode.InternalError, `Failed to get issue: ${error.message}`);
    }
  }

  async logWork(
    issueIdOrKey: string,
    timeSpentSeconds: number,
    comment: string
  ): Promise<JiraWorklog> {
    try {
      const worklogData = {
        timeSpentSeconds,
        comment: {
            type: "doc",
            version: 1,
            content: [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "text",
                            text: comment,
                        },
                    ],
                },
            ],
        },
      };

      const response = await this.client.post(
        `/rest/api/3/issue/${issueIdOrKey}/worklog`,
        worklogData
      );
      return response.data as JiraWorklog;
    } catch (error: any) {
      if (error.response) {
        throw new McpError(
          ErrorCode.InternalError,
          `Jira API error (${error.response.status}): ${JSON.stringify(error.response.data)}`
        );
      }
      throw new McpError(ErrorCode.InternalError, `Failed to log work: ${error.message}`);
    }
  }
}
