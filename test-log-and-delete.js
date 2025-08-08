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
    const now = new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,19); // local-like ISO without ms
    const body = {
      workItemId: 7128,
      timestamp: iso,
      length: 900, // 15 minutes
      comment: 'MCP test log (will delete)'
    };

    console.log('Creating worklog...', body);
    const create = await client.post('/api/rest/worklogs?api-version=3.2', body);
    console.log('Create status:', create.status, create.statusText);
    if (create.status >= 200 && create.status < 300) {
      const created = create.data;
      const id = created.id || created.Id;
      console.log('Created worklog id:', id);

      // Verify by fetching the item
      const get = await client.get(`/api/rest/worklogs/${id}?api-version=3.2`);
      console.log('Fetch created status:', get.status);

      // Cleanup
      const del = await client.delete(`/api/rest/worklogs/${id}?api-version=3.2`);
      console.log('Delete status:', del.status, del.statusText);
      if (del.status >= 200 && del.status < 300) console.log('✅ Test OK');
      else console.log('⚠️ Delete did not return success');
    } else {
      console.log('Create response:', create.data);
      console.log('❌ Could not create (maybe constraints). Trying alternative...');
      // Try with midnight timestamp (date-only)
      const dateOnly = new Date().toISOString().slice(0,10) + 'T00:00:00';
      const body2 = { ...body, timestamp: dateOnly };
      const c2 = await client.post('/api/rest/worklogs?api-version=3.2', body2);
      console.log('Create(alt) status:', c2.status, c2.statusText);
      console.log('Response:', c2.data);
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
