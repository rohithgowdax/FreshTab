# FreshTab

FreshTab gives selected Chrome tabs a cleaner, more disposable session experience without forcing you to wipe your whole browser.

Pick the tabs you want to manage, close them to clear site data automatically, or trigger a clean-session reload when you want to start fresh on the same page.

## Why FreshTab

Sometimes you do not want to clear all of Chrome.
You only want a few tabs to behave more like a fresh visit.

FreshTab is built for that workflow.

It helps when you want to:

- retry a site with a cleaner session
- test flows without manually clearing storage
- reset selected tabs without touching the rest of your browser
- work faster than opening separate profiles for every small check

## Core Features

### Manage only the tabs you choose

You stay in control.
The extension shows the regular website tabs in your current window so you can select exactly which ones should be managed.

### Clear site data when a selected tab closes

Turn on close cleanup and FreshTab will clear the selected tab's site storage when that tab is closed.

### Fresh reload selected tabs

When you want a stronger reset than a normal reload, FreshTab can run its clean reload flow for selected tabs.

That flow:

1. captures the current page
2. moves the tab away from the site
3. clears cookies and storage for that site
4. returns to the original page

### Keyboard shortcut support

Use the fresh reload shortcut for the active selected tab:

- Windows/Linux: `Ctrl+Shift+R`
- Mac: `Command+Shift+R`

## What Gets Cleared

For selected tabs, the extension can clear site data such as:

- cookies
- localStorage
- IndexedDB
- cache
- Cache Storage
- service workers
- file systems
- WebSQL

Cleanup is applied per site origin, not across your entire Chrome profile.

## What This Product Is Not

FreshTab is not a full privacy sandbox or anonymous browser.

It does not change:

- IP address
- browser fingerprint
- device fingerprint
- server-side account state
- broader Chrome profile state

If a site identifies you beyond browser storage, it may still recognize you after cleanup.

## Product Experience

The popup is intentionally simple:

- turn close cleanup on or off
- turn fresh reload mode on or off
- fresh reload selected tabs with one click
- choose the tabs to manage
- quickly select the active tab, all tabs, or clear the selection

The goal is speed.
You should be able to open the popup, pick your tab, and reset it in seconds.

## How It Works

### Close Cleanup

If `Clear selected tabs on close` is enabled:

1. select a tab in the popup
2. use the site normally
3. close the tab
4. FreshTab clears that site's cookies and storage

### Fresh Reload

If `Enable fresh reload shortcut` is enabled:

1. select the tab in the popup
2. use the button or keyboard shortcut
3. the extension clears the site state
4. the page returns in a cleaner session state

## Installation

### Load in Chrome

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select:

```text
/Users/rohithgowda/Documents/New project/fresh-session-tabs
```

5. Pin the extension for easier access if you want

### Reload after updates

If you change the extension files:

1. Go back to `chrome://extensions`
2. Find `FreshTab`
3. Click the reload icon

## Quick Start

### Reset a tab when it closes

1. Open a website tab
2. Open the FreshTab popup
3. Check that tab in `Choose tabs`
4. Turn on `Clear selected tabs on close`
5. Close the tab when you are done

### Run a fresh reload

1. Open a website tab
2. Select it in `Choose tabs`
3. Turn on `Enable fresh reload shortcut`
4. Click `Fresh reload selected tabs`

You can also use:

- `Ctrl+Shift+R` on Windows/Linux
- `Command+Shift+R` on Mac

## Important Limitations

### Chrome owns normal refresh

Chrome does not let a standard extension replace its built-in `Ctrl+R` refresh behavior.

That is why FreshTab uses a separate fresh reload action and shortcut instead of hijacking normal refresh.

### Some sites are harder to reset

If a site still recognizes you after cleanup, it may be using:

- server-side session memory
- account-based state
- fingerprinting
- network or IP correlation
- techniques beyond cookies and local storage

### This is not true tab isolation

FreshTab improves session reset behavior for selected tabs, but it does not create Firefox-style containers or separate Chrome profiles.

## Best Use Cases

FreshTab works best when you want:

- lightweight session resets inside your normal browser
- per-tab control instead of full-browser cleanup
- quick testing on sites that rely mostly on browser storage
- a faster workflow than repeatedly opening temporary profiles

## Project Files

```text
fresh-session-tabs/
├── manifest.json
├── background.js
├── popup.html
├── popup.css
├── popup.js
└── README.md
```

## Troubleshooting

### I do not see tabs in the popup

Make sure you have a normal website tab open using `http` or `https`.
Chrome internal pages such as `chrome://extensions` will not appear in the tab list.

### Close cleanup works, but fresh reload does not fully reset the site

That usually means the site is restoring identity from somewhere outside normal browser storage.
The extension may still be clearing cookies and storage correctly, but the site is using stronger tracking or server-side state.

### The shortcut does not work

Check that:

- the extension has been reloaded
- the active tab is selected
- `Enable fresh reload shortcut` is turned on

## Built With

FreshTab is a Manifest V3 Chrome extension built with:

- Chrome Tabs API
- Chrome Cookies API
- Chrome Browsing Data API
- Chrome Storage API
- Chrome Commands API

## Summary

FreshTab is a focused utility for people who want more control over session resets without managing multiple browser profiles or clearing all of Chrome.

It is simple, selective, and fast:

- choose the tabs
- reset only what you need
- keep the rest of your browser untouched
