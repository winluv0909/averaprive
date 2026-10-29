import {test,expect} from '@playwright/test';
const publicPages=['/','/agencies.html','/compare.html','/for-agencies.html','/pricing.html','/insights.html','/rankings.html','/reviews.html','/trust.html','/about.html','/demo.html','/legal.html'];
for(const path of publicPages)test(`public page remains usable at this viewport: ${path}`,async({page})=>{
 await page.route('**/api/public-agencies',route=>route.fulfill({json:[]}));
 const result=await page.goto(path);
 expect(result?.status()).toBe(200);
 await expect(page.locator('h1').first()).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.getByRole('region',{name:'Privacy choices'}).or(page.locator('aside[aria-label="Privacy choices"]'))).toBeVisible();
});
test('optional analytics are off until consent and can be disabled again',async({page})=>{
 await page.route('**/api/public-agencies',route=>route.fulfill({json:[]}));
 await page.goto('/agencies.html');
 expect(await page.evaluate(()=>sessionStorage.getItem('ap_marketplace_session'))).toBeNull();
 await page.getByRole('button',{name:'Essential only',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('ap_privacy_v1'))).toBe('essential');
 await page.reload();
 await expect(page.locator('aside[aria-label="Privacy choices"]')).toBeHidden();
 await page.locator('a[href$="legal.html#cookies"]').first().click();
 await page.getByRole('button',{name:'Allow directory analytics',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('ap_privacy_v1'))).toBe('analytics');
 await page.locator('a[href$="legal.html#cookies"]').first().click();
 await page.getByRole('button',{name:'Essential only',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('ap_privacy_v1'))).toBe('essential');
});
test('profile inquiry dialog is keyboard usable without sending a request',async({page})=>{
 await page.route('**/api/public-agencies',route=>route.fulfill({json:[{slug:'qa-agency',agencyId:'10000000-0000-4000-8000-000000000001',name:'QA agency',status:'approved',published:true,acceptingInquiries:true,country:'Philippines',services:['Fan messaging'],about:'An isolated browser fixture. No public agency is created.'}]}));
 await page.route('**/api/public-agency-reviews*',route=>route.fulfill({json:[]}));
 await page.goto('/agency-profile.html?id=qa-agency');
 const open=page.locator('#contactAgencyButton');
 await expect(open).toBeVisible();await open.click();
 await expect(page.getByRole('dialog',{name:'Contact this agency'})).toBeVisible();
 await expect(page.locator('#contactConsent')).not.toBeChecked();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog',{name:'Contact this agency'})).toBeHidden();
 await expect(open).toBeFocused();
});
