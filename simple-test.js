#!/usr/bin/env node

// Simple test to verify we can call the 7pace API directly with our credentials
require('dotenv').config();
const axios = require('axios');

async function testDirect7PaceAPI() {
    console.log('Ì∑™ Direct 7pace API test...\n');
    
    const org = process.env.SEVENPACE_ORGANIZATION;
    const token = process.env.SEVENPACE_TOKEN;
    
    if (!org || !token) {
        console.error('‚ùå Missing environment variables');
        return;
    }
    
    console.log('‚úÖ Organization:', org);
    console.log('‚úÖ Token available:', token.length > 0);
    
    try {
        const client = axios.create({
            baseURL: `https://${org}.timehub.7pace.com`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000
        });
        
        // Test the exact working endpoint
        console.log('Ì≥ä Testing: /api/rest/worklogs?api-version=3.2&$top=3');
        const response = await client.get('/api/rest/worklogs?api-version=3.2&$top=3');
        
        console.log('‚úÖ SUCCESS!');
        console.log(`Ì≥à Status: ${response.status}`);
        console.log(`Ì≥ã Found ${response.data.data.length} worklogs`);
        
        if (response.data.data.length > 0) {
            const log = response.data.data[0];
            console.log('\nÌ≥ù Sample worklog:');
            console.log(`   ID: ${log.id}`);
            console.log(`   Work Item: ${log.workItemId}`);
            console.log(`   Length: ${log.length} seconds (${(log.length/3600).toFixed(2)} hours)`);
            console.log(`   Date: ${log.timestamp}`);
            console.log(`   Comment: ${log.comment || '(no comment)'}`);
        }
        
        console.log('\nÌæâ 7pace API is working correctly!');
        console.log('Ì≤° The issue is likely in the MCP server implementation, not the API.');
        
    } catch (error) {
        console.error('‚ùå Failed:', error.message);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data:`, error.response.data);
        }
    }
}

testDirect7PaceAPI().catch(console.error);
