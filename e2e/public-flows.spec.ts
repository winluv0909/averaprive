import {test,expect} from '@playwright/test';
// No form submissions: these checks must not send email or alter account data.
test('recovery form is usable without horizontal overflow',async({page})=>{
 await page.goto('/forgot-password');
 await expect(page.getByRole('heading',{name:'Let’s get you back in.'})).toBeVisible();
 await expect(page.getByLabel('EMAIL ADDRESS',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Send recovery link'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('link',{name:'Owner & staff sign in'}).click();
 await expect(page).toHaveURL(/\/owners\/login$/);
 await expect(page.getByRole('heading',{name:'Platform sign in.'})).toBeVisible();
});
for(const portal of ['owners','agency'])test(`${portal} login links to recovery`,async({page})=>{
 await page.goto(`/${portal}/login`);
 await page.getByRole('link',{name:'Forgot your password?'}).click();
 await expect(page).toHaveURL(/\/forgot-password$/);
});
test('unauthenticated password reset cannot show the password form', async ({page}) => {
  await page.goto('/reset-password');
  await expect(page).toHaveURL(/\/forgot-password\?error=/);
  await expect(page.locator('.recovery-alert[role="alert"]'))
    .toContainText('Open your recovery link first');
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
});
test('invalid recovery links return an understandable error',async({page})=>{
 await page.goto('/auth/recovery');await expect(page).toHaveURL(/\/forgot-password\?error=/);
 await expect(page.locator('.recovery-alert[role="alert"]')).toContainText('invalid or expired');
});
for(const portal of ['owners','agency'])test(`${portal} dashboard requires login`,async({page})=>{
 await page.goto(`/${portal}/dashboard`);await expect(page).toHaveURL(new RegExp(`/${portal}/login\\?next=`));
});
const agencies=[
 {slug:'alpha-fixture',name:'Alpha Fixture',status:'approved',published:true,services:['Fan messaging'],country:'Philippines',publishedAt:'2026-10-01T00:00:00Z'},
 {slug:'beta-fixture',name:'Beta Fixture',status:'approved',published:true,services:['Content production'],country:'Canada',publishedAt:'2026-10-20T00:00:00Z'}
];
test('directory service filter and clear use published data',async({page})=>{
 await page.route('**/api/public-agencies',route=>route.fulfill({json:agencies}));
 await page.route('**/api/marketplace/event',route=>route.fulfill({json:{ok:true}}));
 await page.goto('/agencies.html');
 await expect(page.locator('#resultCount')).toHaveText('2');
 await page.locator('#serviceFilter').selectOption({label:'Fan messaging'});
 await expect(page.locator('#resultCount')).toHaveText('1');
 await expect(page.locator('#agencyCardGrid .agency-name')).toHaveText(['Alpha Fixture']);
 // Switch services, then clear through the actual responsive filter controls.
 await page.locator('#serviceFilter').selectOption({label:'Content production'});
 await expect(page.locator('#agencyCardGrid .agency-name')).toHaveText(['Beta Fixture']);
 if(await page.locator('#mobileFilterButton').isVisible()) await page.locator('#mobileFilterButton').click();
 await page.locator('#clearFilters').click();await expect(page.locator('#resultCount')).toHaveText('2');
 await page.locator('#sortFilter').selectOption('newest');
 await expect(page.locator('#agencyCardGrid .agency-name')).toHaveText(['Beta Fixture','Alpha Fixture']);
});
