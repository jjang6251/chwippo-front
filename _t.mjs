import { chromium } from '@playwright/test'
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,colorScheme:'dark'})
const req=[]; p.on('request',r=>{if(r.url().includes('localhost:3000'))req.push(new URL(r.url()).pathname)})
await p.goto('http://localhost:5173/',{waitUntil:'networkidle'}); await p.waitForTimeout(2500)
console.log('백엔드 요청: '+[...new Set(req)].join(', '))
await p.locator('text=캘린더 — 날짜별로').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(700)
await p.screenshot({path:process.argv[2]+'/ag.png'})
await b.close()
