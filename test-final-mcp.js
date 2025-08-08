#!/usr/bin/env node

// Test the updated MCP server with real 7pace API
require('dotenv').config();
const { spawn } = require('child_process');

async function testMCPServer() {
    console.log('í·ª Testing updated 7pace MCP Server with real API...\n');
    
    // Start the server
    const server = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
    });

    let hasConnected = false;

    server.stdout.on('data', (data) => {
        console.log('í³¤ Server response:', data.toString().trim());
    });

    server.stderr.on('data', (data) => {
        const message = data.toString().trim();
        console.log('í³¥ Server status:', message);
        
        if (message.includes('7pace Timetracker MCP server running')) {
            hasConnected = true;
            console.log('âœ… MCP server started successfully!');
            testGetWorklogs(server);
        }
    });

    server.on('close', (code) => {
        console.log(`\ní¿ Test completed with code: ${code}`);
        if (hasConnected) {
            console.log('âœ… 7pace MCP Server is ready for Cursor integration!');
        }
    });

    server.on('error', (error) => {
        console.error('âŒ Server error:', error.message);
    });

    // Initialize MCP
    setTimeout(() => {
        console.log('\ní³‹ Initializing MCP protocol...');
        
        const initMessage = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "test-client", version: "1.0.0" }
            }
        }) + '\n';
        
        server.stdin.write(initMessage);
    }, 1000);

    // Cleanup after 10 seconds
    setTimeout(() => {
        server.kill();
    }, 10000);
}

function testGetWorklogs(server) {
    setTimeout(() => {
        console.log('\ní´§ Testing get_worklogs tool (this will test 7pace API)...');
        
        const toolMessage = JSON.stringify({
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call", 
            params: {
                name: "get_worklogs",
                arguments: {
                    // Get recent worklogs without filters to test API
                }
            }
        }) + '\n';
        
        server.stdin.write(toolMessage);
    }, 3000);
}

testMCPServer().catch(console.error);
