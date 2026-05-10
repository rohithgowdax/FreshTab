const STORAGE_KEYS = {
  closeCleanupEnabled: "closeCleanupEnabled",
  refreshCleanupEnabled: "refreshCleanupEnabled",
  selectedTabIds: "selectedTabIds"
};

function getShortcutLabel() {
  const isMac = navigator.platform.toLowerCase().includes("mac");
  return isMac ? "Command+Shift+R" : "Ctrl+Shift+R";
}

function formatTabLabel(tab) {
  const title = tab.title || "Untitled tab";

  try {
    const parsed = new URL(tab.url || "");
    return parsed.pathname && parsed.pathname !== "/"
      ? `${title} (${parsed.hostname}${parsed.pathname})`
      : `${title} (${parsed.hostname})`;
  } catch (error) {
    return `${title} (unsupported)`;
  }
}

async function loadSettings() {
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

async function saveSelectedTabIds(selectedTabIds) {
  await chrome.storage.local.set({ [STORAGE_KEYS.selectedTabIds]: selectedTabIds });
}

async function getTrackableTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.filter((tab) => {
    try {
      const parsed = new URL(tab.url || "");
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (error) {
      return false;
    }
  });
}

function buildStatus(settings) {
  const selectedCount = Object.keys(settings.selectedTabIds).length;
  const parts = [];

  if (settings.closeCleanupEnabled) {
    parts.push("close cleanup on");
  }

  if (settings.refreshCleanupEnabled) {
    parts.push("fresh reload on");
  }

  if (parts.length === 0) {
    return "All cleanup is off.";
  }

  if (selectedCount === 0) {
    return `${parts.join(", ")}. No tabs selected yet.`;
  }

  return `${parts.join(", ")}. ${selectedCount} selected tab${selectedCount === 1 ? "" : "s"}.`;
}

async function renderTabList(selectedTabIds) {
  const tabList = document.getElementById("tabList");
  const trackableTabs = await getTrackableTabs();

  tabList.replaceChildren();

  if (trackableTabs.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "emptyState";
    emptyState.textContent = "No regular website tabs are open in this window.";
    tabList.appendChild(emptyState);
    return;
  }

  for (const tab of trackableTabs) {
    const row = document.createElement("label");
    row.className = "tabRow";

    const checkbox = document.createElement("input");
    checkbox.className = "tabCheckbox";
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(selectedTabIds[String(tab.id)]);
    checkbox.addEventListener("change", async () => {
      if (checkbox.checked) {
        selectedTabIds[String(tab.id)] = true;
      } else {
        delete selectedTabIds[String(tab.id)];
      }

      await saveSelectedTabIds(selectedTabIds);
      await render();
    });

    const text = document.createElement("span");
    text.className = "tabLabel";
    text.textContent = formatTabLabel(tab);

    row.append(checkbox, text);
    tabList.appendChild(row);
  }
}

async function render(customStatus) {
  const settings = await loadSettings();

  document.getElementById("closeCleanupToggle").checked = settings.closeCleanupEnabled;
  document.getElementById("refreshCleanupToggle").checked = settings.refreshCleanupEnabled;
  document.getElementById("statusText").textContent = customStatus || buildStatus(settings);

  await renderTabList(settings.selectedTabIds);
}

document.getElementById("closeCleanupToggle").addEventListener("change", async (event) => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.closeCleanupEnabled]: event.target.checked
  });

  await render();
});

document.getElementById("refreshCleanupToggle").addEventListener("change", async (event) => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.refreshCleanupEnabled]: event.target.checked
  });

  await render();
});

document.getElementById("freshReloadButton").addEventListener("click", async () => {
  const button = document.getElementById("freshReloadButton");
  button.disabled = true;
  button.textContent = "Refreshing...";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "fresh-reload-selected-tabs"
    });

    if (response?.ok) {
      await render(`Fresh reloaded ${response.reloadedCount} selected tab${response.reloadedCount === 1 ? "" : "s"}.`);
      return;
    }

    await render("Fresh reload could not run for the selected tabs.");
  } finally {
    button.disabled = false;
    button.textContent = "Fresh reload selected tabs";
  }
});

document.getElementById("selectActiveButton").addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
  const activeTab = tabs[0];

  if (!activeTab?.id) {
    await render("No active website tab was found.");
    return;
  }

  try {
    const parsed = new URL(activeTab.url || "");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      await render("The active tab is not a regular website tab.");
      return;
    }
  } catch (error) {
    await render("The active tab is not a regular website tab.");
    return;
  }

  const settings = await loadSettings();
  settings.selectedTabIds[String(activeTab.id)] = true;
  await saveSelectedTabIds(settings.selectedTabIds);
  await render("Active tab selected.");
});

document.getElementById("selectAllButton").addEventListener("click", async () => {
  const tabs = await getTrackableTabs();
  const selectedTabIds = {};

  for (const tab of tabs) {
    selectedTabIds[String(tab.id)] = true;
  }

  await saveSelectedTabIds(selectedTabIds);
  await render("All website tabs selected.");
});

document.getElementById("clearAllButton").addEventListener("click", async () => {
  await saveSelectedTabIds({});
  await render("Selection cleared.");
});

void render();
