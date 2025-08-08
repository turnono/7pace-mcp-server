#!/usr/bin/env node

// Debug MCP server API calls
require('dotenv').config();
const { spawn } = require('child_process');

async function debugMCPServer() {
    console.log('í´ Debugging MCP server API calls...\n');
    
    const server = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
    });

    server.stdout.on('data', (data) => {
        console.log('í³¤ STDOUT:', data.toString());
    });

    server.stderr.on('data', (data) => {
        console.log('í³¥ STDERR:', data.toString());
    });

    // Initialize and test immediately
    setTimeout(() => {
        console.log('í³‹ Sending initialize...');
        server.stdin.write(JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "debug-client", version: "1.0.0" }
            }
        }) + '\n');
    }, 500);

    setTimeout(() => {
        console.log('í´§ Testing simple get_worklogs (no params)...');
        server.stdin.write(JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/call",
            params: {
                name: "get_worklogs",
                arguments: {}
            }
        }) + '\n');
    }, 2000);

    setTimeout(() => {
        server.kill();
    }, 5000);
}

debugMCPServer().catch(console.error);
