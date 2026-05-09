const STORAGE_KEYS = {
  closeCleanupEnabled: "closeCleanupEnabled",
  refreshCleanupEnabled: "refreshCleanupEnabled",
  selectedTabIds: "selectedTabIds"
};

const tabOrigins = new Map();

async function getSettings() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.closeCleanupEnabled,
    STORAGE_KEYS.refreshCleanupEnabled,
    STORAGE_KEYS.selectedTabIds
  ]);

  return {
    closeCleanupEnabled: result[STORAGE_KEYS.closeCleanupEnabled] !== false,
    refreshCleanupEnabled: result[STORAGE_KEYS.refreshCleanupEnabled] !== false,
    selectedTabIds: result[STORAGE_KEYS.selectedTabIds] || {}
  };
}

async function isTabSelected(tabId) {
  const { selectedTabIds } = await getSettings();
  return Boolean(selectedTabIds[String(tabId)]);
}

async function updateActionState() {
  const { closeCleanupEnabled, refreshCleanupEnabled, selectedTabIds } = await getSettings();
  const selectedCount = Object.keys(selectedTabIds).length;
  const anyEnabled = closeCleanupEnabled || refreshCleanupEnabled;

  await chrome.action.setBadgeText({
    text: anyEnabled ? String(selectedCount || "") : "OFF"
  });

  await chrome.action.setBadgeBackgroundColor({
    color: anyEnabled ? "#1f9d55" : "#c0392b"
  });

  await chrome.action.setTitle({
    title: anyEnabled
      ? `Fresh Session Tabs: ${selectedCount} selected`
      : "Fresh Session Tabs: all cleanup disabled"
  });
}

function getTrackableUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawUrl);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    return parsedUrl;
  } catch (error) {
    console.warn("Skipping invalid tab URL", rawUrl, error);
    return null;
  }
}

function rememberTabUrl(tabId, rawUrl) {
  const parsedUrl = getTrackableUrl(rawUrl);

  if (!parsedUrl) {
    tabOrigins.delete(tabId);
    return;
  }

  tabOrigins.set(tabId, {
    url: parsedUrl.href,
    origin: parsedUrl.origin,
    hostname: parsedUrl.hostname
  });
}

async function ensureTabEntry(tabId) {
  const existingEntry = tabOrigins.get(tabId);

  if (existingEntry) {
    return existingEntry;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    rememberTabUrl(tabId, tab.url);
    return tabOrigins.get(tabId) || null;
  } catch (error) {
    console.warn("Unable to resolve tab URL", tabId, error);
    return null;
  }
}

async function clearCookiesForHostname(hostname) {
  const cookies = await chrome.cookies.getAll({ domain: hostname });

  await Promise.all(
    cookies.map(async (cookie) => {
      const protocol = cookie.secure ? "https:" : "http:";
      const normalizedDomain = cookie.domain.replace(/^\./, "");
      const cookieUrl = `${protocol}//${normalizedDomain}${cookie.path}`;

      try {
        await chrome.cookies.remove({
          name: cookie.name,
          storeId: cookie.storeId,
          url: cookieUrl
        });
      } catch (error) {
        console.error("Failed to remove cookie", cookie.name, error);
      }
    })
  );
}

async function clearSiteDataForTab(tabId, reason) {
  const entry = await ensureTabEntry(tabId);

  if (!entry) {
    return false;
  }

  if (!(await isTabSelected(tabId))) {
    return false;
  }

  try {
    console.log(`Clearing site data for ${entry.origin} (${reason})`);

    await clearCookiesForHostname(entry.hostname);

    await chrome.browsingData.remove(
      { origins: [entry.origin] },
      {
        cache: true,
        cacheStorage: true,
        cookies: true,
        fileSystems: true,
        indexedDB: true,
        localStorage: true,
        serviceWorkers: true,
        webSQL: true
      }
    );

    console.log(`Finished clearing site data for ${entry.origin} (${reason})`);
    return true;
  } catch (error) {
    console.error("Failed to clear site data", entry.origin, error);
    return false;
  }
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function freshReloadTab(tabId) {
  const { refreshCleanupEnabled } = await getSettings();

  if (!refreshCleanupEnabled) {
    return false;
  }

  const entry = await ensureTabEntry(tabId);

  if (!entry) {
    return false;
  }

  const cleared = await clearSiteDataForTab(tabId, "fresh-reload");

  if (!cleared) {
    return false;
  }

  try {
    const blankLoad = waitForTabComplete(tabId);
    await chrome.tabs.update(tabId, { url: "about:blank" });
    await blankLoad;

    await clearSiteDataForTab(tabId, "fresh-reload-after-blank");

    await chrome.tabs.update(tabId, { url: entry.url });
    return true;
  } catch (error) {
    console.error("Failed to reload tab", tabId, error);
    return false;
  }
}

async function freshReloadSelectedTabs() {
  const { selectedTabIds } = await getSettings();
  const tabIds = Object.keys(selectedTabIds).map((value) => Number(value));
  let count = 0;

  for (const tabId of tabIds) {
    if (await freshReloadTab(tabId)) {
      count += 1;
    }
  }

  return count;
}

async function removeTabSelection(tabId) {
  const { selectedTabIds } = await getSettings();

  if (!selectedTabIds[String(tabId)]) {
    return;
  }

  delete selectedTabIds[String(tabId)];
  await chrome.storage.local.set({ [STORAGE_KEYS.selectedTabIds]: selectedTabIds });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    rememberTabUrl(tabId, changeInfo.url);
    return;
  }

  if (changeInfo.status === "complete") {
    rememberTabUrl(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    rememberTabUrl(tabId, tab.url);
  } catch (error) {
    console.warn("Unable to read activated tab", tabId, error);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const { closeCleanupEnabled } = await getSettings();

    if (closeCleanupEnabled) {
      await clearSiteDataForTab(tabId, "close");
    }

    await removeTabSelection(tabId);
    tabOrigins.delete(tabId);
  })();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "fresh-reload-selected-tabs") {
    void (async () => {
      const reloadedCount = await freshReloadSelectedTabs();
      sendResponse({ ok: true, reloadedCount });
    })();
    return true;
  }

  if (message?.type === "fresh-reload-active-tab") {
    void (async () => {
      const tabId = sender.tab?.id ?? message.tabId;
      const ok = typeof tabId === "number" ? await freshReloadTab(tabId) : false;
      sendResponse({ ok });
    })();
    return true;
  }

  return false;
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "fresh-reload-active-tab") {
    return;
  }

  const tabId = tab?.id;

  if (typeof tabId !== "number") {
    return;
  }

  void freshReloadTab(tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    const existing = await chrome.storage.local.get([
      STORAGE_KEYS.closeCleanupEnabled,
      STORAGE_KEYS.refreshCleanupEnabled,
      STORAGE_KEYS.selectedTabIds
    ]);

    await chrome.storage.local.set({
      [STORAGE_KEYS.closeCleanupEnabled]: existing[STORAGE_KEYS.closeCleanupEnabled] !== false,
      [STORAGE_KEYS.refreshCleanupEnabled]: existing[STORAGE_KEYS.refreshCleanupEnabled] !== false,
      [STORAGE_KEYS.selectedTabIds]: existing[STORAGE_KEYS.selectedTabIds] || {}
    });

    await updateActionState();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void updateActionState();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (
    changes[STORAGE_KEYS.closeCleanupEnabled] ||
    changes[STORAGE_KEYS.refreshCleanupEnabled] ||
    changes[STORAGE_KEYS.selectedTabIds]
  ) {
    void updateActionState();
  }
});

void updateActionState();
