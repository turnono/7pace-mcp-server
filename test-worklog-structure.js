#!/usr/bin/env node

// Test to understand the worklog structure from 7pace
require('dotenv').config();
const axios = require('axios');

async function analyzeWorklogStructure() {
    console.log('Ì¥ç Analyzing 7pace worklog structure...\n');
    
    const org = process.env.SEVENPACE_ORGANIZATION;
    const token = process.env.SEVENPACE_TOKEN;
    
    const client = axios.create({
        baseURL: `https://${org}.timehub.7pace.com`,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        timeout: 10000
    });
    
    try {
        // Get a sample worklog to understand the structure
        console.log('Ì≥ä Fetching sample worklogs...');
        const response = await client.get('/api/rest/worklogs?api-version=3.2&$top=3');
        
        console.log(`‚úÖ Found ${response.data.data.length} worklogs`);
        
        if (response.data.data.length > 0) {
            const sample = response.data.data[0];
            console.log('\nÌ≥ã Sample worklog structure:');
            console.log(JSON.stringify(sample, null, 2));
            
            console.log('\nÌ¥ë Available fields:');
            Object.keys(sample).forEach(key => {
                console.log(`  ${key}: ${typeof sample[key]} = ${sample[key]}`);
            });
            
            console.log('\nÌ≤° Key insights for MCP server:');
            console.log(`- ID field: ${sample.Id ? 'Id' : sample.id ? 'id' : 'unknown'}`);
            console.log(`- WorkItem field: ${sample.WorkItemId ? 'WorkItemId' : sample.workItemId ? 'workItemId' : 'unknown'}`);
            console.log(`- Length field: ${sample.Length ? 'Length' : sample.length ? 'length' : 'unknown'}`);
            console.log(`- Comment field: ${sample.Comment ? 'Comment' : sample.comment ? 'comment' : 'unknown'}`);
            console.log(`- Timestamp field: ${sample.Timestamp ? 'Timestamp' : sample.timestamp ? 'timestamp' : 'unknown'}`);
        }
        
    } catch (error) {
        console.error('‚ùå Failed to analyze structure:', error.message);
    }
}

analyzeWorklogStructure().catch(console.error);
