// Example clip: mark the first feed video as watched (it disappears, since hiding is on by
// default), and switch "Hide watched" on if a seeded state had it off.
const TOGGLE = '#osasoft-better-subscriptions_hide-watched-toggle';

export default async function (page) {
    const markBtn = page.locator('.subs-btn-mark-watched').first();
    await markBtn.waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await markBtn.click();
    await page.waitForTimeout(2000);
    const toggle = page.locator(TOGGLE).first();
    if ((await toggle.getAttribute('class')).includes('subs-btn-hide-watched-unchecked')) {
        await toggle.click();
    }
    await page.waitForTimeout(1000);
}
