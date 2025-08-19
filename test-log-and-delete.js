#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');

(async function run() {
  const org = process.env.SEVENPACE_ORGANIZATION;
  const token = process.env.SEVENPACE_TOKEN;
  if (!org || !token) {
    console.error('Missing SEVENPACE_ORGANIZATION or SEVENPACE_TOKEN');
    process.exit(1);
  }
  const client = axios.create({
    baseURL: `https://${org}.timehub.7pace.com`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  try {
    const historicalDate = '2025-07-30';
    const body = {
      workItemId: 7128,
      timestamp: historicalDate + 'T12:00:00', // Using a specific time to avoid timezone issues
      length: 900, // 15 minutes
      comment: 'MCP test log for historical date (will delete)'
    };

    console.log('Creating worklog with historical date...', body);
    const create = await client.post('/api/rest/worklogs?api-version=3.2', body);
    console.log('Create status:', create.status, create.statusText);

    if (create.status >= 200 && create.status < 300) {
      const created = create.data;
      const id = created.id || created.Id;
      console.log('Created worklog id:', id);

      // Verify by fetching the item
      const get = await client.get(`/api/rest/worklogs/${id}?api-version=3.2`);
      console.log('Fetch created status:', get.status);
      const fetchedWorklog = get.data;
      const fetchedTimestamp = fetchedWorklog.timestamp || fetchedWorklog.Timestamp;

      if (fetchedTimestamp && fetchedTimestamp.startsWith(historicalDate)) {
        console.log(`✅ Date verification PASSED. Expected: ${historicalDate}, Got: ${fetchedTimestamp}`);
      } else {
        console.error(`❌ Date verification FAILED. Expected: ${historicalDate}, Got: ${fetchedTimestamp}`);
        // Cleanup before exiting
        await client.delete(`/api/rest/worklogs/${id}?api-version=3.2`);
        process.exit(1);
      }

      // Cleanup
      const del = await client.delete(`/api/rest/worklogs/${id}?api-version=3.2`);
      console.log('Delete status:', del.status, del.statusText);
      if (del.status >= 200 && del.status < 300) {
        console.log('✅ Test OK');
      } else {
        console.log('⚠️ Delete did not return success');
      }
    } else {
      console.log('Create response:', create.data);
      console.log('❌ Could not create worklog.');
      process.exit(1);
    }
  } catch (e) {
    if (e.response) {
      console.error('HTTP Error', e.response.status, e.response.statusText, e.response.data);
    } else {
      console.error('Error', e.message);
    }
    process.exit(1);
  }
})();
