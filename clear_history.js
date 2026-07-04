// Run this in the extension's DevTools console to clear history and start fresh
chrome.storage.local.clear(() => {
  console.log('History cleared. Watch 15-20 videos to retrain.');
});
