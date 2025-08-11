#!/usr/bin/env node

// Test to reproduce the "write failing silently" issue
require('dotenv').config();
const { SevenPaceService } = require('./dist/index.js');

async function testWriteIssue() {
    console.log('🔍 Testing write operation issue...\n');
    
    // Create a service instance with test config
    const config = {
        baseUrl: `https://test-org.timehub.7pace.com`,
        token: 'test-token-replace-with-real-token',
        organizationName: 'test-org'
    };
    
    const service = new SevenPaceService(config);
    
    try {
        console.log('📝 Attempting to log time...');
        
        const entry = {
            workItemId: 1234,
            date: '2024-01-15',
            hours: 2.0,
            description: 'Test entry to reproduce write issue',
            activityType: 'Development'
        };
        
        const result = await service.logTime(entry);
        
        console.log('✅ logTime returned successfully');
        console.log('📋 Result:', JSON.stringify(result, null, 2));
        
        // Now try to verify if the entry was actually created
        console.log('\n🔍 Verifying if entry was actually created...');
        
        const worklogs = await service.getWorklogs(1234, '2024-01-15', '2024-01-15');
        console.log(`📊 Found ${worklogs.length} worklogs for work item 1234 on 2024-01-15`);
        
        if (worklogs.length === 0) {
            console.log('❌ ISSUE CONFIRMED: logTime claimed success but no worklog was created!');
        } else {
            console.log('✅ Worklog creation verified');
        }
        
    } catch (error) {
        console.log('⚠️ Expected error with test credentials:', error.message);
        
        // This is expected since we're using test credentials
        if (error.message.includes('test credentials')) {
            console.log('✅ Test credentials check is working correctly');
            
            // Now let's test what happens with a mock response
            console.log('\n🧪 Testing with mock response scenario...');
            testMockResponse();
        }
    }
}

function testMockResponse() {
    console.log('🔬 Simulating potential silent failure scenarios:');
    console.log('1. API returns 200 OK but with error in response body');
    console.log('2. API returns 200 OK but worklog is not actually created');
    console.log('3. Response data structure is unexpected');
    
    // Mock scenarios that could cause silent failures
    const mockResponses = [
        {
            status: 200,
            statusText: 'OK',
            data: { error: 'Validation failed', success: false }
        },
        {
            status: 200,
            statusText: 'OK', 
            data: { message: 'Accepted', id: null }
        },
        {
            status: 200,
            statusText: 'OK',
            data: null
        }
    ];
    
    mockResponses.forEach((response, index) => {
        console.log(`\n📋 Mock Response ${index + 1}:`, JSON.stringify(response, null, 2));
        console.log('   Issue: This could be interpreted as success but indicates failure');
    });
}

if (require.main === module) {
    testWriteIssue().catch(console.error);
}