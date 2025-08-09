#!/usr/bin/env node

// Comprehensive test suite for 7pace MCP Server
require('dotenv').config();

async function runAllTests() {
    console.log('🧪 7pace MCP Server - Complete Test Suite\n');
    
    let passedTests = 0;
    let totalTests = 0;
    
    // Test 1: Health Check
    console.log('1️⃣ Running Health Check...');
    totalTests++;
    try {
        const { healthCheck } = require('./health-check.js');
        const result = await healthCheck();
        if (result) {
            console.log('✅ Health Check: PASSED\n');
            passedTests++;
        } else {
            console.log('❌ Health Check: FAILED\n');
        }
    } catch (error) {
        console.log('❌ Health Check: ERROR -', error.message, '\n');
    }
    
    // Test 2: Environment Configuration
    console.log('2️⃣ Testing Environment Configuration...');
    totalTests++;
    try {
        const org = process.env.SEVENPACE_ORGANIZATION;
        const token = process.env.SEVENPACE_TOKEN;
        
        if (org && token) {
            console.log('✅ Environment Configuration: PASSED');
            console.log(`   Organization: ${org}`);
            console.log(`   Token: ${token.length > 20 ? 'REAL TOKEN' : 'TEST TOKEN'}`);
            if (token === 'test-token-replace-with-real-token') {
                console.log('   ⚠️  Using test credentials - API calls will be limited');
            }
            console.log('');
            passedTests++;
        } else {
            console.log('❌ Environment Configuration: FAILED - Missing required variables\n');
        }
    } catch (error) {
        console.log('❌ Environment Configuration: ERROR -', error.message, '\n');
    }
    
    // Test 3: Build Check
    console.log('3️⃣ Testing Build System...');
    totalTests++;
    try {
        const fs = require('fs');
        const distExists = fs.existsSync('./dist/index.js');
        const packageExists = fs.existsSync('./package.json');
        
        if (distExists && packageExists) {
            const stats = fs.statSync('./dist/index.js');
            console.log('✅ Build System: PASSED');
            console.log(`   Built file exists: ./dist/index.js (${Math.round(stats.size/1024)}KB)`);
            console.log('');
            passedTests++;
        } else {
            console.log('❌ Build System: FAILED - Missing build artifacts\n');
        }
    } catch (error) {
        console.log('❌ Build System: ERROR -', error.message, '\n');
    }
    
    // Test 4: MCP Protocol Compatibility
    console.log('4️⃣ Testing MCP Protocol Compatibility...');
    totalTests++;
    try {
        // This is tested by the health check, but we'll verify the tools are correctly defined
        const { spawn } = require('child_process');
        
        const testResult = await new Promise((resolve) => {
            const server = spawn('node', ['dist/index.js'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: process.env
            });
            
            let toolsReceived = false;
            
            server.stdout.on('data', (data) => {
                try {
                    const parsed = JSON.parse(data.toString());
                    if (parsed.id === 2 && parsed.result?.tools) {
                        const tools = parsed.result.tools;
                        const expectedTools = ['log_time', 'get_worklogs', 'update_worklog', 'delete_worklog', 'generate_time_report'];
                        const hasAllTools = expectedTools.every(tool => 
                            tools.some(t => t.name === tool)
                        );
                        
                        if (hasAllTools && tools.length === expectedTools.length) {
                            toolsReceived = true;
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                        server.kill();
                    }
                } catch (e) {
                    // Ignore parsing errors
                }
            });
            
            server.stderr.on('data', (data) => {
                if (data.toString().includes('7pace Timetracker MCP server running')) {
                    // Initialize and list tools
                    setTimeout(() => {
                        const initMessage = JSON.stringify({
                            jsonrpc: "2.0",
                            id: 1,
                            method: "initialize",
                            params: {
                                protocolVersion: "2024-11-05",
                                capabilities: {},
                                clientInfo: { name: "test-suite", version: "1.0.0" }
                            }
                        }) + '\n';
                        server.stdin.write(initMessage);
                        
                        setTimeout(() => {
                            const listToolsMessage = JSON.stringify({
                                jsonrpc: "2.0",
                                id: 2,
                                method: "tools/list",
                                params: {}
                            }) + '\n';
                            server.stdin.write(listToolsMessage);
                        }, 100);
                    }, 100);
                }
            });
            
            setTimeout(() => {
                server.kill();
                resolve(false);
            }, 3000);
        });
        
        if (testResult) {
            console.log('✅ MCP Protocol Compatibility: PASSED');
            console.log('   All 5 tools properly defined and accessible');
            console.log('');
            passedTests++;
        } else {
            console.log('❌ MCP Protocol Compatibility: FAILED\n');
        }
    } catch (error) {
        console.log('❌ MCP Protocol Compatibility: ERROR -', error.message, '\n');
    }
    
    // Summary
    console.log('📊 Test Results Summary');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success Rate: ${Math.round((passedTests/totalTests) * 100)}%`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 ALL TESTS PASSED! 7pace MCP Server is working correctly.');
        console.log('✅ The server is ready for use with MCP clients like Cursor.');
        return true;
    } else {
        console.log('\n❌ Some tests failed. Please check the errors above.');
        return false;
    }
}

if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests };