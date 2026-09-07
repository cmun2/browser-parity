import { chromium } from 'playwright';
const b=await chromium.launch(); const p=await b.newPage();
try{ const r=await p.goto('https://example.com',{timeout:15000}); console.log('STATUS',r.status(), await p.title()); }
catch(e){ console.log('FAIL', e.message.slice(0,120)); }
await b.close();
