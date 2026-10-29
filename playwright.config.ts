import {defineConfig,devices} from '@playwright/test';
// Always use an isolated local server, never a deployed site or a real auth project.
export default defineConfig({
 testDir:'./e2e',testMatch:'**/*.spec.ts',fullyParallel:false,workers:1,
 forbidOnly:!!process.env.CI,retries:process.env.CI?1:0,timeout:45_000,
 expect:{timeout:10_000},reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:3106',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'desktop-chromium',use:{...devices['Desktop Chrome']}},{name:'mobile-chromium',use:{...devices['Pixel 7']}}],
 webServer:{command:'npm run build && npm run start -- --hostname 127.0.0.1 --port 3106',url:'http://127.0.0.1:3106/forgot-password',reuseExistingServer:false,timeout:180_000,
 env:{AP_BROWSER_TEST:'true',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:9',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'browser-test-placeholder',NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3106',SUPABASE_SERVICE_ROLE_KEY:'browser-test-placeholder'}}
});
