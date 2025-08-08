#!/usr/bin/env node

// Test 7pace API connection with real token
require('dotenv').config();
const axios = require('axios');

async function test7PaceConnection() {
    console.log('� Testing 7pace Timetracker connection...\n');
    
    // Check environment variables
    const org = process.env.SEVENPACE_ORGANIZATION;
    const token = process.env.SEVENPACE_TOKEN;
    
    if (!org || !token) {
        console.error('❌ Missing required environment variables');
        console.log('Expected: SEVENPACE_ORGANIZATION and SEVENPACE_TOKEN');
        return;
    }
    
    console.log('✅ Organization:', org);
    console.log('✅ Token configured:', token.substring(0, 20) + '...');
    
    // Construct API URL
    const baseUrl = `https://${org}.timehub.7pace.com`;
    console.log('� API Base URL:', baseUrl);
    
    try {
        // Test basic API connectivity
        console.log('\n� Testing API connectivity...');
        
        const client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000
        });
        
        // Try to get worklog information (simple GET request)
        console.log('� Attempting to fetch worklogs...');
        const response = await client.get('/api/rest/worklogs?$top=1');
        
        console.log('✅ 7pace API connection successful!');
        console.log('� Response status:', response.status);
        console.log('� Data type:', typeof response.data);
        
        if (response.data && response.data.value) {
            console.log('� Found', response.data.value.length, 'recent worklogs');
            if (response.data.value.length > 0) {
                const firstLog = response.data.value[0];
                console.log('� Sample worklog:', {
                    id: firstLog.id,
                    workItemId: firstLog.workItemId,
                    length: firstLog.length + ' minutes',
                    timestamp: firstLog.timestamp
                });
            }
        }
        
        console.log('\n� 7pace MCP Server is ready to use!');
        console.log('\n� You can now use commands like:');
        console.log('   "Log 2 hours on work item 7128 for architecture investigation"');
        console.log('   "Show me my time logs for this week"');
        console.log('   "Generate a time report for last week"');
        
    } catch (error) {
        console.error('\n❌ 7pace API connection failed:');
        
        if (error.response) {
            console.error('� Status:', error.response.status);
            console.error('� Status Text:', error.response.statusText);
            console.error('� Response:', error.response.data);
            
            if (error.response.status === 401) {
                console.log('\n� Authentication failed. Please check:');
                console.log('   - Token is valid and not expired');
                console.log('   - Token has proper permissions');
                console.log('   - Organization name is correct');
            } else if (error.response.status === 404) {
                console.log('\n� Resource not found. Please check:');
                console.log('   - Organization name in SEVENPACE_ORGANIZATION');
                console.log('   - URL: ' + baseUrl);
            }
        } else if (error.request) {
            console.error('� Network error:', error.message);
            console.log('\n� Please check:');
            console.log('   - Internet connectivity');
            console.log('   - 7pace service availability');
            console.log('   - Firewall/proxy settings');
        } else {
            console.error('⚠️  Request setup error:', error.message);
        }
    }
}

// Run the test
test7PaceConnection().catch(console.error);
