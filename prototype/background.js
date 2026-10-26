// Keeps dim.js registered to run on every site you've approved,
// as early as possible in page load.
async function sync() {
  const { origins = [] } = await chrome.permissions.getAll();
  await chrome.scripting.unregisterContentScripts().catch(() => {});
  if (origins.length) {
    await chrome.scripting.registerContentScripts([{
      id: "dim",
      matches: origins,
      js: ["dim.js"],
      runAt: "document_start"
    }]);
  }
}

chrome.runtime.onInstalled.addListener(sync);
chrome.runtime.onStartup.addListener(sync);
chrome.permissions.onAdded.addListener(sync);
chrome.permissions.onRemoved.addListener(sync);