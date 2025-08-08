#!/usr/bin/env node

// Simple test script to verify MCP server structure without 7pace token
const { spawn } = require('child_process');
const readline = require('readline');

console.log('🧪 Testing 7pace MCP Server structure...\n');

// Test environment setup
process.env.SEVENPACE_ORGANIZATION = 'labournet';
process.env.SEVENPACE_TOKEN = 'test_token_for_structure_test';

console.log('Environment check:');
console.log('✅ SEVENPACE_ORGANIZATION:', process.env.SEVENPACE_ORGANIZATION);
console.log('✅ Token configured (test mode)');
console.log('');

// Test MCP server initialization
try {
    // Import the server (this will test compilation and basic structure)
    console.log('Testing MCP server import...');

    // Start the server process
    const server = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
    });

    let output = '';
    let hasInitialized = false;

    server.stdout.on('data', (data) => {
        output += data.toString();
        console.log('📤 Server output:', data.toString().trim());
    });

    server.stderr.on('data', (data) => {
        const message = data.toString().trim();
        console.log('📥 Server status:', message);

        if (message.includes('7pace Timetracker MCP server running')) {
            hasInitialized = true;
            console.log('✅ MCP server initialized successfully!');
            testMCPTools(server);
        }
    });

    server.on('close', (code) => {
        console.log(`\n🏁 Server process ended with code: ${code}`);
        if (hasInitialized) {
            console.log('✅ Structure test completed successfully!');
        } else {
            console.log('⚠️  Server may need proper 7pace token for full functionality');
        }
    });

    // Send MCP initialization
    setTimeout(() => {
        console.log('\n📋 Testing MCP protocol initialization...');

        const initMessage = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: {
                    name: "test-client",
                    version: "1.0.0"
                }
            }
        }) + '\n';

        server.stdin.write(initMessage);
    }, 1000);

    // Cleanup after 5 seconds
    setTimeout(() => {
        server.kill();
    }, 5000);

} catch (error) {
    console.error('❌ Error testing server:', error.message);
}

function testMCPTools(server) {
    setTimeout(() => {
        console.log('\n🔧 Testing available tools...');

        const toolsMessage = JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list"
        }) + '\n';

        server.stdin.write(toolsMessage);
    }, 2000);
}
