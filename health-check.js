#!/usr/bin/env node

// Health check script to verify MCP server basic functionality
require('dotenv').config();
const { spawn } = require('child_process');

async function healthCheck() {
    console.log('🔍 7pace MCP Server Health Check\n');
    
    // Check environment variables
    console.log('📋 Environment Configuration:');
    console.log(`   Organization: ${process.env.SEVENPACE_ORGANIZATION || '❌ NOT SET'}`);
    console.log(`   Token: ${process.env.SEVENPACE_TOKEN ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   Azure DevOps URL: ${process.env.AZURE_DEVOPS_ORG_URL || '❌ NOT SET'}`);
    
    if (!process.env.SEVENPACE_ORGANIZATION || !process.env.SEVENPACE_TOKEN) {
        console.log('\n⚠️  Warning: Using test credentials. For real testing, update .env file with actual values.');
    }
    
    console.log('\n🚀 Starting MCP Server...');
    
    return new Promise((resolve) => {
        const server = spawn('node', ['dist/index.js'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env
        });

        let initialized = false;
        let toolsListed = false;

        server.stdout.on('data', (data) => {
            const response = data.toString().trim();
            if (response) {
                try {
                    const parsed = JSON.parse(response);
                    if (parsed.id === 1 && parsed.result) {
                        initialized = true;
                        console.log('✅ MCP Protocol initialized successfully');
                        console.log(`   Server: ${parsed.result.serverInfo?.name || 'Unknown'}`);
                        console.log(`   Version: ${parsed.result.serverInfo?.version || 'Unknown'}`);
                        
                        // Test tools listing
                        setTimeout(() => {
                            const listToolsMessage = JSON.stringify({
                                jsonrpc: "2.0",
                                id: 2,
                                method: "tools/list",
                                params: {}
                            }) + '\n';
                            server.stdin.write(listToolsMessage);
                        }, 100);
                    } else if (parsed.id === 2 && parsed.result?.tools) {
                        toolsListed = true;
                        console.log('✅ Tools listed successfully');
                        console.log(`   Available tools: ${parsed.result.tools.length}`);
                        parsed.result.tools.forEach((tool, index) => {
                            console.log(`   ${index + 1}. ${tool.name}: ${tool.description}`);
                        });
                        
                        // All checks passed
                        console.log('\n🎉 Health Check PASSED!');
                        console.log('✅ MCP Server is working correctly');
                        server.kill();
                        resolve(true);
                    }
                } catch (e) {
                    // Non-JSON response, ignore
                }
            }
        });

        server.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (message.includes('7pace Timetracker MCP server running')) {
                console.log('✅ Server started on stdio transport');
                
                // Initialize MCP protocol
                setTimeout(() => {
                    const initMessage = JSON.stringify({
                        jsonrpc: "2.0",
                        id: 1,
                        method: "initialize",
                        params: {
                            protocolVersion: "2024-11-05",
                            capabilities: {},
                            clientInfo: { name: "health-check", version: "1.0.0" }
                        }
                    }) + '\n';
                    server.stdin.write(initMessage);
                }, 100);
            } else if (message.includes('Missing required environment variables')) {
                console.log('❌ Environment configuration error');
                console.log('💡 Make sure to set SEVENPACE_ORGANIZATION and SEVENPACE_TOKEN in .env file');
                server.kill();
                resolve(false);
            }
        });

        server.on('close', (code) => {
            if (!initialized && !toolsListed) {
                console.log(`\n❌ Health Check FAILED (exit code: ${code})`);
                resolve(false);
            }
        });

        server.on('error', (error) => {
            console.error('❌ Server error:', error.message);
            resolve(false);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
            if (!initialized || !toolsListed) {
                console.log('\n⏰ Health check timeout');
                console.log('❌ Server did not respond within 5 seconds');
                server.kill();
                resolve(false);
            }
        }, 5000);
    });
}

if (require.main === module) {
    healthCheck().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Health check failed:', error);
        process.exit(1);
    });
}

module.exports = { healthCheck };