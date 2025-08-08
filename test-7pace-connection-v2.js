#!/usr/bin/env node

// Test 7pace API connection with proper API version
require('dotenv').config();
const axios = require('axios');

async function test7PaceConnection() {
    console.log('í´ Testing 7pace Timetracker connection (v2)...\n');
    
    const org = process.env.SEVENPACE_ORGANIZATION;
    const token = process.env.SEVENPACE_TOKEN;
    
    if (!org || !token) {
        console.error('âŒ Missing required environment variables');
        return;
    }
    
    console.log('âœ… Organization:', org);
    console.log('âœ… Token configured:', token.substring(0, 20) + '...');
    
    const baseUrl = `https://${org}.timehub.7pace.com`;
    console.log('í¼ API Base URL:', baseUrl);
    
    try {
        console.log('\ní³¡ Testing API connectivity with version...');
        
        const client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000
        });
        
        // Try different API versions and endpoints
        const testEndpoints = [
            '/api/odata/v3.0/WorkLogs?$top=1',
            '/api/rest/worklogs?api-version=3.2&$top=1', 
            '/api/rest/worklogs?api-version=3.1&$top=1',
            '/api/rest/worklogs?api-version=3.0&$top=1'
        ];
        
        for (const endpoint of testEndpoints) {
            try {
                console.log(`í³Š Testing: ${endpoint}`);
                const response = await client.get(endpoint);
                
                console.log('âœ… SUCCESS! API connection working');
                console.log('í³ˆ Response status:', response.status);
                console.log('í³‹ Endpoint:', endpoint);
                
                if (response.data) {
                    if (response.data.value) {
                        console.log('í³ Found', response.data.value.length, 'worklogs');
                        if (response.data.value.length > 0) {
                            const log = response.data.value[0];
                            console.log('í³‹ Sample worklog:', {
                                id: log.Id || log.id,
                                workItemId: log.WorkItemId || log.workItemId,
                                length: (log.Length || log.length) + ' minutes',
                                timestamp: log.Timestamp || log.timestamp
                            });
                        }
                    } else {
                        console.log('í³Š Response structure:', Object.keys(response.data));
                    }
                }
                
                console.log('\ní¾‰ 7pace API is working! Using endpoint:', endpoint);
                return endpoint; // Return successful endpoint
                
            } catch (err) {
                console.log('âŒ Failed:', endpoint, '-', err.response?.status || err.message);
            }
        }
        
        console.log('\nâš ï¸  None of the standard endpoints worked. This might mean:');
        console.log('- 7pace version is different than expected');
        console.log('- API structure has changed');
        console.log('- Additional authentication required');
        
    } catch (error) {
        console.error('\nâŒ General connection error:', error.message);
    }
}

test7PaceConnection().then(endpoint => {
    if (endpoint) {
        console.log('\níº€ Update your MCP server to use this endpoint pattern!');
    }
}).catch(console.error);
