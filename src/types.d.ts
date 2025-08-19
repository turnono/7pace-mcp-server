declare module "express";
declare module "cors";
declare module "@modelcontextprotocol/sdk/server/streamableHttp.js" {
  export class StreamableHTTPServerTransport {
    constructor(options?: any);
    handleRequest: (req: any, res: any, body: any) => Promise<void>;
  }
}
