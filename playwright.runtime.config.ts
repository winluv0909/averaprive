import base from './playwright.config';
import {defineConfig} from '@playwright/test';
export default defineConfig({...base,use:{...base.use,launchOptions:{executablePath:'/tmp/ap-browser-runtime/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-software-rasterizer']}}});
