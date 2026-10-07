const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { SevenPaceService } = require("./dist/index.js");
const { ntlmAdapter, readNtlmCredentials } = require("./dist/ntlm.js");
const axios = require("axios");

test("REST shapes, filters, pagination, seconds and write methods", async () => {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const url = new URL(req.url, "http://localhost");
      calls.push({ url, method: req.method, body: body && JSON.parse(body) });
      res.setHeader("Content-Type", "application/json");
      if (url.pathname.endsWith("activitytypes")) {
        res.end(JSON.stringify({data:{activityTypes:[{id:"id-1",name:"Development"}]}}));
      } else if (req.method === "POST" || req.method === "PATCH") {
        res.end(JSON.stringify({data:{id:"saved-id"}}));
      } else if (req.method === "DELETE") {
        res.end(JSON.stringify({data:{}}));
      } else {
        const count = url.searchParams.get("$skip") === "0" ? 500 : 1;
        res.end(JSON.stringify({data:Array.from({length:count}, () => ({
          id:"log-1", workItemId:42, timestamp:"2026-10-06T10:00:00", length:300
        }))}));
      }
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  process.env.SEVENPACE_API_PATH = "/api/example-collection/rest";
  delete process.env.SEVENPACE_AUTH_METHOD;
  const service = new SevenPaceService({
    baseUrl:"http://127.0.0.1:" + server.address().port,
    token:"test-local", organizationName:"example-collection"
  });
  try {
    assert.deepEqual(await service.listActivityTypes(), [{id:"id-1",name:"Development"}]);
    const logs = await service.getWorklogs(42, "2026-10-06", "2026-10-06");
    assert.equal(logs.length, 501);
    const reads = calls.filter(c => c.url.pathname.endsWith("worklogs"));
    assert.equal(reads[0].url.pathname, "/api/example-collection/rest/worklogs");
    assert.equal(reads[0].url.searchParams.get("$workItemIds"), "42");
    assert.equal(reads[0].url.searchParams.get("$fromTimestamp"), "2026-10-06T00:00:00");
    assert.equal(reads[1].url.searchParams.get("$skip"), "500");
    const report = await service.getTimeReport("2026-10-06", "2026-10-06");
    assert.equal(report.totalHours, 501 * 300 / 3600);
    const created = await service.logTime({date:"2026-10-06",workItemId:42,hours:0.5,description:"Test"});
    assert.equal(created.id, "saved-id");
    const post = calls.find(c => c.method === "POST");
    assert.equal(post.body.timeStamp, "2026-10-06T00:00:00");
    assert.equal(post.body.length, 1800);
    assert.equal(post.body.billableLength, 1800);
    await service.updateWorklog("saved-id", {hours:0.25});
    assert.equal(calls.at(-1).method, "PATCH");
    assert.equal(calls.at(-1).body.length, 900);
    await service.deleteWorklog("saved-id");
    assert.equal(calls.at(-1).method, "DELETE");
  } finally {
    server.close();
    delete process.env.SEVENPACE_API_PATH;
  }
});

test("stdio overrides inherited inspector PORT and exposes MCP tools", async () => {
  const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
  const transport = new StdioClientTransport({
    command:process.execPath, args:["dist/index.js"],
    env:{...process.env, PORT:"6277", MCP_TRANSPORT:"stdio",
      SEVENPACE_ORGANIZATION:"test", SEVENPACE_TOKEN:"test-local"},
    stderr:"pipe"
  });
  const client = new Client({name:"regression-test",version:"1.0"},{capabilities:{}});
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert(tools.tools.some(t => t.name === "get_worklogs"));
    const health = await client.callTool({name:"health",arguments:{}});
    assert(!health.isError);
  } finally {
    await client.close();
  }
});

const { generateNegotiateResponse } = require("@node-ntlm/core/testing");
const { parseType2Message, createNTHashedPasswordV1 } = require("@node-ntlm/core");
const { createHmac } = require("node:crypto");

test("native NTLMv2 authenticates on one socket and sends write bodies once", async () => {
  const calls = [];
  let handshakeSocket;
  let challenge;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const auth = req.headers.authorization || "";
      const message = Buffer.from(auth.split(" ")[1] || "", "base64");
      const type = message.length >= 12 ? message.readUInt32LE(8) : 0;
      calls.push({ method:req.method, type, body, socket:req.socket });
      if (type === 1) {
        handshakeSocket = req.socket;
        challenge = generateNegotiateResponse(auth);
        res.writeHead(401, { "WWW-Authenticate": challenge, "Content-Length": "0" });
        res.end();
      } else if (type === 3) {
        assert.equal(req.socket, handshakeSocket);
        const response = message.subarray(message.readUInt32LE(24),
          message.readUInt32LE(24) + message.readUInt16LE(20));
        assert(response.length > 24, "NTLMv2 response");
        const hash = createHmac("md5", createNTHashedPasswordV1("synthetic-password"))
          .update(Buffer.from("EXAMPLE-USEREXAMPLE", "utf16le")).digest();
        const expected = createHmac("md5", hash)
          .update(Buffer.concat([parseType2Message(challenge).serverChallenge, response.subarray(16)])).digest();
        assert.deepEqual(response.subarray(0, 16), expected, "password proof verified");
        res.writeHead(req.url === "/failure" ? 401 : 200, { "Content-Type":"application/json" });
        res.end(JSON.stringify({data:{ok:true}}));
      } else {
        res.writeHead(401, { "WWW-Authenticate":"NTLM" }); res.end();
      }
    });
  });
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  Object.assign(process.env, {
    SEVENPACE_USERNAME:"EXAMPLE\\example-user", SEVENPACE_PASSWORD:"synthetic-password",
  });
  const client = axios.create({
    baseURL:"http://127.0.0.1:"+server.address().port, adapter:ntlmAdapter, timeout:1000,
  });
  try {
    assert.equal(readNtlmCredentials().domain,"EXAMPLE");
    for (const method of ["get","post","patch","delete"]) {
      const result = await client.request({method,url:"/success",data: method === "post" || method === "patch" ? {value:42} : undefined});
      assert.deepEqual(result.data,{data:{ok:true}});
    }
    assert.equal(calls.length,8);
    assert(calls.filter(c=>c.type===1).every(c=>c.body===""));
    assert(calls.filter(c=>c.type===3 && ["post","patch"].includes(c.method.toLowerCase()))
      .every(c=>JSON.parse(c.body).value===42));
    await assert.rejects(client.get("/failure"),/HTTP 401/);
    await assert.rejects(client.get("http://other.example/"),/configured origin/);
  } finally {
    delete process.env.SEVENPACE_USERNAME;
    delete process.env.SEVENPACE_PASSWORD;
    server.close();
  }
});

test("NTLM rejects missing credentials, redirects and legacy challenges", async () => {
  assert.throws(readNtlmCredentials,/SEVENPACE_USERNAME and SEVENPACE_PASSWORD/);
  const server = http.createServer((req,res) => {
    if(req.url === "/redirect") {
      res.writeHead(302, {Location:"http://other.example/"}); res.end();
    } else if (req.url === "/timeout") {
      // Intentional silence: the client's configured timeout must end the request.
    } else {
      const type1 = Buffer.from(req.headers.authorization.split(" ")[1],"base64");
      type1.writeUInt32LE((type1.readUInt32LE(12) & ~0x80000) >>> 0,12);
      res.writeHead(401, { "WWW-Authenticate":generateNegotiateResponse("NTLM "+type1.toString("base64")) });
      res.end();
    }
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  Object.assign(process.env,{SEVENPACE_USERNAME:"test-user",SEVENPACE_PASSWORD:"test-password"});
  const client=axios.create({baseURL:"http://127.0.0.1:"+server.address().port,adapter:ntlmAdapter,timeout:100});
  try {
    await assert.rejects(client.get("/redirect"),/HTTP 302/);
    await assert.rejects(client.get("/legacy"),/NTLMv2/);
    await assert.rejects(client.get("/timeout"),/timeout/i);
  } finally {
    delete process.env.SEVENPACE_USERNAME;
    delete process.env.SEVENPACE_PASSWORD;
    server.closeAllConnections();
    server.close();
  }
});
