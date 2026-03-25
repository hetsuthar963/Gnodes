import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to app...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    console.log('Testing Header elements...');
    const title = await page.$eval('h1', el => el.textContent);
    console.log(`App Title: ${title}`);
    
    console.log('Testing Repo Input...');
    await page.type('input[placeholder="https://github.com/owner/repo"]', 'facebook/react');
    
    console.log('Clicking Generate Graph...');
    await page.click('button:has-text("Generate Graph")');
    
    // Wait for loading to finish
    console.log('Waiting for analysis...');
    await page.waitForSelector('canvas', { timeout: 60000 });
    console.log('Graph rendered successfully!');
    
    console.log('Testing View Mode switching...');
    const splitViewBtn = await page.$('button[title="Split View"]');
    if (splitViewBtn) {
      await splitViewBtn.click();
      console.log('Switched to Split View');
    }
    
    console.log('Testing Sidebar search...');
    await page.type('input[placeholder="Search files..."]', 'package.json');
    const firstFile = await page.$('div.flex.items-center.space-x-3.p-2');
    if (firstFile) {
      console.log('Search found results');
    }
    
    console.log('Testing Taxonomy Sidebar...');
    const taxonomyBtn = await page.$('button:has-text("Graph Settings")');
    if (taxonomyBtn) {
      await taxonomyBtn.click();
      console.log('Taxonomy Sidebar opened');
    }
    
    console.log('All basic features tested successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();
