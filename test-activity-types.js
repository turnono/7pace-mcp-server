#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');
(async()=>{
  const org=process.env.SEVENPACE_ORGANIZATION, token=process.env.SEVENPACE_TOKEN;
  const c=axios.create({baseURL:`https://${org}.timehub.7pace.com`,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},timeout:15000});
  const r=await c.get('/api/rest/activitytypes?api-version=3.2');
  console.log('status',r.status, r.statusText);
  console.log(r.data);
})();
