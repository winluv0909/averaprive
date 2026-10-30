import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {renderProfileHtml} from '../lib/agencies/profile-html';
const agency={name:'Avera QA Fixture',slug:'qa-fixture',about:'A published agency overview available before JavaScript runs.',country:'Philippines',city:'Manila'};
const html=renderProfileHtml(readFileSync('public/agency-profile.html','utf8'),agency);
test('branded 404 and report-only CSP are served by the application',async({page})=>{
 const response=await page.goto('/this-page-does-not-exist');expect(response?.status()).toBe(404);
 await expect(page.getByRole('heading',{name:'This page has moved out of view.'})).toBeVisible();
 expect(response?.headers()['content-security-policy-report-only']).toContain('report-uri /api/csp-report');
 expect(response?.headers()['content-security-policy']).toBeUndefined();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('server-rendered profile is readable without JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
 await page.route('**/agencies/qa-fixture',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://127.0.0.1:3106/agencies/qa-fixture');
 await expect(page.getByRole('heading',{name:agency.name,exact:true})).toBeVisible();
 await expect(page.locator('#agencyDescription')).toHaveText(agency.about);
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',/\/agencies\/qa-fixture$/);
 await context.close();
});
test('profile template retains contact modal and inquiry submission',async({page})=>{
 await page.route('**/agencies/qa-fixture',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.route('**/api/public-agencies',route=>route.fulfill({json:[{...agency,id:agency.slug,agencyId:'fixture-id',status:'approved',published:true,acceptingInquiries:true,services:['Management'],description:agency.about}]}));
 await page.route('**/api/public-agency-reviews?*',route=>route.fulfill({json:{reviews:[],totalReviews:0}}));
 await page.route('**/api/marketplace/inquiry',async route=>{expect(route.request().postDataJSON().consent).toBe(true);await route.fulfill({status:201,json:{id:'fixture',status:'received'}});});
 await page.goto('/agencies/qa-fixture');
 await page.getByRole('button',{name:'Contact Agency',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByLabel('Your name').fill('QA Tester');await page.getByLabel('Email address',{exact:true}).fill('qa@example.com');
 await page.getByLabel('How can the agency help?').fill('This is a clearly identified isolated inquiry test.');
 await page.locator('#contactConsent').check();await page.getByRole('button',{name:'Send inquiry',exact:true}).click();
 await expect(page.locator('#contactFormMessage')).toContainText('Inquiry received securely');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('real inquiry endpoint accepts same-origin parsing and rejects unsafe requests',async({request})=>{
 const url='http://127.0.0.1:3106/api/marketplace/inquiry';
 expect((await request.post(url,{headers:{origin:'https://other.example','content-type':'application/json'},data:'{}'})).status()).toBe(403);
 expect((await request.post(url,{headers:{origin:'http://127.0.0.1:3106','content-type':'text/plain'},data:'{}'})).status()).toBe(415);
 expect((await request.post(url,{headers:{origin:'http://127.0.0.1:3106','content-type':'application/json'},data:'{}'})).status()).toBe(400);
 expect((await request.post(url,{headers:{origin:'http://127.0.0.1:3106','content-type':'application/json'},data:'x'.repeat(12001)})).status()).toBe(413);
});
