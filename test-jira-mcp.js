#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🧪 Testing Jira MCP Server...\n');

// --- Configuration ---
// Set dummy environment variables for the test.
// The server will initialize but fail on actual API calls, which is expected.
process.env.JIRA_BASE_URL = 'https://your-domain.atlassian.net';
process.env.JIRA_EMAIL = 'test@example.com';
process.env.JIRA_API_TOKEN = 'dummy-token';

console.log('Environment check:');
console.log('✅ JIRA_BASE_URL:', process.env.JIRA_BASE_URL);
console.log('✅ JIRA_EMAIL:', process.env.JIRA_EMAIL);
console.log('✅ JIRA_API_TOKEN: dummy-token');
console.log('');

let messageId = 1;
const server = spawn('node', ['jira-mcp-server/dist/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    // Use a relative path for the CWD
    cwd: process.cwd(),
});

// Function to send a JSON-RPC message to the server
function sendMessage(method, params) {
    const message = JSON.stringify({
        jsonrpc: "2.0",
        id: messageId++,
        method,
        params,
    }) + '\n';
    console.log(`\n=> Sending message to server: ${message}`);
    server.stdin.write(message);
}

server.stdout.on('data', (data) => {
    console.log(`<= Received from server: ${data.toString()}`);
});

server.stderr.on('data', (data) => {
    const message = data.toString().trim();
    console.log(`[SERVER STDERR]: ${message}`);

    // Once the server is running, start sending commands
    if (message.includes('Jira MCP server running on stdio')) {
        console.log('\n✅ Server initialized. Starting tests...');

        // 1. List tools
        setTimeout(() => sendMessage("tools/list", {}), 500);

        // 2. Call get_issue (expected to fail gracefully)
        setTimeout(() => sendMessage("tools/call", {
            name: "get_issue",
            arguments: { issueIdOrKey: "TEST-123" }
        }), 1000);

        // 3. Call log_work (expected to fail gracefully)
        setTimeout(() => sendMessage("tools/call", {
            name: "log_work",
            arguments: { issueIdOrKey: "TEST-123", hours: 1, comment: "Test worklog" }
        }), 1500);

        // 4. Terminate the server after tests
        setTimeout(() => {
            console.log('\n🏁 Test sequence complete. Terminating server.');
            server.kill();
        }, 2500);
    }
});

server.on('close', (code) => {
    console.log(`\nServer process exited with code ${code}`);
    console.log('✅ Test finished.');
});

server.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
});
