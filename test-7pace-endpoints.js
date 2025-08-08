#!/usr/bin/env node

// Comprehensive test of different 7pace API endpoints
require('dotenv').config();
const axios = require('axios');

async function test7PaceEndpoints() {
    console.log('Ì¥ç Testing various 7pace API endpoints...\n');
    
    const org = process.env.SEVENPACE_ORGANIZATION;
    const token = process.env.SEVENPACE_TOKEN;
    
    if (!org || !token) {
        console.error('‚ùå Missing environment variables');
        return;
    }
    
    const baseUrl = `https://${org}.timehub.7pace.com`;
    const client = axios.create({
        baseURL: baseUrl,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        timeout: 10000
    });
    
    // Test different API patterns
    const testEndpoints = [
        // OData endpoints
        '/api/odata/v3.2/WorkLogs?$top=1',
        '/api/odata/v3.0/WorkLogs?$top=1', 
        '/api/odata/WorkLogs?$top=1',
        
        // REST endpoints with different versions
        '/api/rest/worklogs?api-version=3.2&$top=1',
        '/api/rest/worklogs?api-version=3.1&$top=1',
        '/api/rest/worklogs?api-version=3.0&$top=1',
        '/api/rest/worklogs?api-version=2.0&$top=1',
        
        // Simple REST without version
        '/api/rest/worklogs?$top=1',
        '/api/worklogs?$top=1',
        
        // Try different resource names
        '/api/rest/workLogsWorkItems?api-version=3.2&$top=1',
        '/api/odata/v3.2/workLogsWorkItems?$top=1',
        
        // General info endpoints
        '/api/info',
        '/api/version',
        '/'
    ];
    
    let workingEndpoint = null;
    
    for (const endpoint of testEndpoints) {
        try {
            console.log(`Ì≥ä Testing: ${endpoint}`);
            const response = await client.get(endpoint);
            
            console.log('‚úÖ SUCCESS!');
            console.log(`   Status: ${response.status}`);
            console.log(`   Content-Type: ${response.headers['content-type']}`);
            
            if (response.data) {
                if (response.data.value && Array.isArray(response.data.value)) {
                    console.log(`   OData format: ${response.data.value.length} items`);
                    if (response.data.value.length > 0) {
                        const sample = response.data.value[0];
                        console.log(`   Sample keys:`, Object.keys(sample).slice(0, 5).join(', '));
                    }
                    workingEndpoint = endpoint;
                    break;
                } else if (response.data.data && Array.isArray(response.data.data)) {
                    console.log(`   REST format: ${response.data.data.length} items`);
                    workingEndpoint = endpoint;
                    break;
                } else if (Array.isArray(response.data)) {
                    console.log(`   Array format: ${response.data.length} items`);
                    workingEndpoint = endpoint;
                    break;
                } else {
                    console.log(`   Response type: ${typeof response.data}`);
                    console.log(`   Keys:`, Object.keys(response.data).slice(0, 5).join(', '));
                }
            }
            
        } catch (error) {
            if (error.response) {
                console.log(`‚ùå ${error.response.status}: ${error.response.statusText}`);
                if (error.response.data && error.response.data.error) {
                    console.log(`   Error: ${error.response.data.error.errorDescription || error.response.data.error.message}`);
                }
            } else {
                console.log(`‚ùå ${error.message}`);
            }
        }
        console.log('');
    }
    
    if (workingEndpoint) {
        console.log(`Ìæâ Found working endpoint: ${workingEndpoint}`);
        console.log('\nÌ≥ù Update your MCP server to use this endpoint pattern!');
        
        // Test creating a worklog
        await testCreateWorklog(client, workingEndpoint);
    } else {
        console.log('‚ö†Ô∏è  No working endpoints found. Possible issues:');
        console.log('- Token might not have correct permissions');
        console.log('- 7pace version might be different');
        console.log('- Organization name might be incorrect');
    }
}

async function testCreateWorklog(client, workingEndpoint) {
    console.log('\nÌ∑™ Testing worklog creation...');
    
    try {
        const testWorklog = {
            WorkItemId: 7128, // Your multi-company tabs work item
            Length: 120, // 2 hours in minutes
            Timestamp: new Date().toISOString(),
            Comment: 'Test log from MCP server setup'
        };
        
        // Extract the base endpoint for POST
        const postEndpoint = workingEndpoint.split('?')[0];
        console.log(`Ì≥§ POST to: ${postEndpoint}`);
        
        const response = await client.post(postEndpoint + '?api-version=3.2', testWorklog);
        
        console.log('‚úÖ Worklog creation successful!');
        console.log(`   Created ID: ${response.data.Id || response.data.id}`);
        console.log('   Ì∫Ä Your MCP server is ready for full functionality!');
        
    } catch (error) {
        console.log('‚ùå Worklog creation failed (this is OK for testing):');
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Error: ${error.response.data?.error?.errorDescription || error.response.statusText}`);
        } else {
            console.log(`   Error: ${error.message}`);
        }
    }
}

test7PaceEndpoints().catch(console.error);
