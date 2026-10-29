(function () {
  "use strict";

  var Core = globalThis.MdBlockCore;
  if (!Core) {
    return;
  }

  var surface = Core.detectSurface(window.location, document.referrer);
  if (surface === "ignore") {
    return;
  }

  var settings = Core.normalizeSettings(Core.DEFAULT_SETTINGS);
  var extensionSet = Core.toExtensionSet(settings.extensions);
  var configRev = 1;
  var elementCache = typeof WeakMap === "function" ? new WeakMap() : null;

  var lastStats = {
    hiddenCount: 0,
    visibleDocCount: 0,
    totalCandidates: 0,
    hiddenByExt: {}
  };

  var styleEl = null;
  var pillHost = null;
  var pillButton = null;
  var pillTextNode = null;
  var observer = null;
  var rafScheduled = false;

  var lastPaginatedHiddenCount = 0;
  var autoPageSteps = 0;
  var autoPageTimer = null;
  var lastReportedBadgeKey = "";

  function ensureStyleInjected() {
    if (styleEl && styleEl.isConnected) {
      return;
    }
    var target = document.head || document.documentElement;
    if (!target) {
      return;
    }
    styleEl = document.getElementById("md-block-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "md-block-style";
      styleEl.textContent = [
        'html[data-md-block-active="true"] [data-md-block-hidden="true"] {',
        "  display: none !important;",
        "}",
        'html[data-md-block-active="true"] [data-md-block-empty-section="true"] {',
        "  display: none !important;",
        "}"
      ].join("\n");
      target.appendChild(styleEl);
    }
    syncRootActiveAttribute();
  }

  function syncRootActiveAttribute() {
    if (!document.documentElement) {
      return;
    }
    var desired = settings.enabled ? "true" : "false";
    if (document.documentElement.getAttribute("data-md-block-active") !== desired) {
      document.documentElement.setAttribute("data-md-block-active", desired);
    }
  }

  function ensurePill() {
    if (!settings.showPill) {
      if (pillHost && pillHost.isConnected) {
        pillHost.remove();
      }
      return;
    }

    if (!document.body) {
      return;
    }

    if (!pillHost) {
      pillHost = document.createElement("div");
      pillHost.id = "md-block-pill-host";
      pillHost.setAttribute("data-md-block-ignore", "true");

      var shadow = pillHost.attachShadow({ mode: "open" });
      var pillStyle = document.createElement("style");
      pillStyle.textContent = [
        ":host {",
        "  all: initial;",
        "  position: fixed;",
        surface === "picker"
          ? "  top: 14px; right: 56px;"
          : "  bottom: 18px; left: 18px;",
        "  z-index: 2147483000;",
        "  font-family: 'Google Sans', Roboto, Arial, sans-serif;",
        "}",
        ".pill {",
        "  display: inline-flex;",
        "  align-items: center;",
        "  gap: 7px;",
        "  padding: 6px 12px;",
        "  border-radius: 999px;",
        "  border: 1px solid #dadce0;",
        "  background: rgba(255, 255, 255, 0.95);",
        "  color: #3c4043;",
        "  font-family: inherit;",
        "  font-size: 12px;",
        "  font-weight: 500;",
        "  line-height: 16px;",
        "  letter-spacing: 0.1px;",
        "  box-shadow: 0 1px 3px rgba(60, 64, 67, 0.16);",
        "  cursor: pointer;",
        "  user-select: none;",
        "  transition: background-color 120ms ease, border-color 120ms ease, opacity 120ms ease;",
        "}",
        ".pill:hover {",
        "  background: #f1f3f4;",
        "  border-color: #bdc1c6;",
        "  opacity: 1;",
        "}",
        ".pill:focus-visible {",
        "  outline: 2px solid #1a73e8;",
        "  outline-offset: 2px;",
        "}",
        '.pill[data-quiet="true"] {',
        "  opacity: 0.72;",
        "}",
        '.pill[data-paused="true"] {',
        "  background: #fef7e0;",
        "  border-color: #f2cf66;",
        "  color: #5f4300;",
        "  opacity: 1;",
        "}",
        '.pill[data-paused="true"]:hover {',
        "  background: #feefc3;",
        "}",
        '.pill[data-hidden-pill="true"] {',
        "  display: none;",
        "}",
        ".dot {",
        "  width: 7px;",
        "  height: 7px;",
        "  border-radius: 50%;",
        "  background: #1a73e8;",
        "  flex-shrink: 0;",
        "}",
        '.pill[data-quiet="true"] .dot {',
        "  background: #80868b;",
        "}",
        '.pill[data-paused="true"] .dot {',
        "  background: #d9822b;",
        "}"
      ].join("\n");

      pillButton = document.createElement("button");
      pillButton.type = "button";
      pillButton.className = "pill";

      var dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");

      pillTextNode = document.createElement("span");

      pillButton.appendChild(dot);
      pillButton.appendChild(pillTextNode);
      pillButton.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        toggleEnabled();
      });

      shadow.appendChild(pillStyle);
      shadow.appendChild(pillButton);
    }

    if (!pillHost.isConnected) {
      document.body.appendChild(pillHost);
    }

    updatePillUI();
  }

  function updatePillUI() {
    if (!pillButton || !pillTextNode) {
      return;
    }

    // In the file picker dialog, stay invisible when nothing is filtered and filter is active.
    if (surface === "picker" && settings.enabled && lastStats.hiddenCount === 0) {
      pillButton.setAttribute("data-hidden-pill", "true");
      return;
    }

    pillButton.removeAttribute("data-hidden-pill");
    pillTextNode.textContent = Core.formatPillLabel(lastStats, settings.enabled);

    var isPaused = !settings.enabled;
    var isQuiet = settings.enabled && lastStats.hiddenCount === 0;

    pillButton.setAttribute("data-paused", isPaused ? "true" : "false");
    pillButton.setAttribute("data-quiet", isQuiet ? "true" : "false");
    pillButton.title = Core.formatPillTooltip(lastStats, settings.enabled);
  }

  function toggleEnabled() {
    settings.enabled = !settings.enabled;
    syncRootActiveAttribute();
    updatePillUI();
    reportBadgeCount();

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ enabled: settings.enabled });
    }

    if (settings.enabled) {
      maybeNudgePagination();
    }
  }

  function reportBadgeCount() {
    if (surface !== "homescreen") {
      return;
    }
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }
    var key = String(settings.enabled) + ":" + String(lastStats.hiddenCount);
    if (key === lastReportedBadgeKey) {
      return;
    }
    lastReportedBadgeKey = key;
    try {
      chrome.runtime.sendMessage({
        type: "md-block:badge",
        enabled: settings.enabled,
        hiddenCount: lastStats.hiddenCount
      });
    } catch (_err) {
      // Extension context may have been reloaded; safe to ignore.
    }
  }

  function isViewportScrollable() {
    var scroller =
      document.querySelector(".docs-homescreen-container") ||
      document.scrollingElement ||
      document.documentElement;
    if (!scroller) {
      return true;
    }
    return scroller.scrollHeight > scroller.clientHeight + 160;
  }

  /**
   * When many .md items at the top of Recent Documents are hidden, the remaining
   * visible items may no longer fill the screen or show a scrollbar. Dispatching
   * scroll/resize events nudges Google Docs to fetch the next batch of documents.
   */
  function maybeNudgePagination() {
    if (!settings.enabled || surface !== "homescreen") {
      return;
    }
    if (lastStats.hiddenCount === 0) {
      return;
    }
    if (lastStats.hiddenCount <= lastPaginatedHiddenCount) {
      return;
    }
    if (lastStats.visibleDocCount >= 14 && isViewportScrollable()) {
      return;
    }
    if (autoPageSteps >= 15) {
      return;
    }

    if (autoPageTimer) {
      clearTimeout(autoPageTimer);
    }

    autoPageTimer = setTimeout(function () {
      autoPageTimer = null;
      if (!settings.enabled) {
        return;
      }
      lastPaginatedHiddenCount = lastStats.hiddenCount;
      autoPageSteps += 1;

      var containers = document.querySelectorAll(
        ".docs-homescreen-container, .docs-homescreen-item-container"
      );
      for (var i = 0; i < containers.length; i += 1) {
        containers[i].dispatchEvent(new Event("scroll", { bubbles: true }));
      }
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("resize"));
    }, 180);
  }

  function teardownIfLeftSurface() {
    var currentSurface = Core.detectSurface(window.location, document.referrer);
    if (currentSurface !== "ignore") {
      return false;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (styleEl && styleEl.isConnected) {
      styleEl.remove();
    }
    if (pillHost && pillHost.isConnected) {
      pillHost.remove();
    }
    if (document.documentElement) {
      document.documentElement.removeAttribute("data-md-block-active");
    }
    return true;
  }

  function runScan() {
    rafScheduled = false;
    if (teardownIfLeftSurface()) {
      return;
    }

    ensureStyleInjected();
    lastStats = Core.applyFilterPass(
      document,
      surface,
      extensionSet,
      elementCache,
      configRev
    );
    ensurePill();
    updatePillUI();
    reportBadgeCount();
    maybeNudgePagination();
  }

  function scheduleScan() {
    if (rafScheduled) {
      return;
    }
    rafScheduled = true;
    requestAnimationFrame(runScan);
  }

  function applyLoadedSettings(raw) {
    settings = Core.normalizeSettings(raw);
    extensionSet = Core.toExtensionSet(settings.extensions);
    configRev += 1;
    lastPaginatedHiddenCount = 0;
    autoPageSteps = 0;
    syncRootActiveAttribute();
    scheduleScan();
  }

  function startObserver() {
    if (observer || !document.documentElement) {
      return;
    }
    observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var target = mutations[i].target;
        if (pillHost && (target === pillHost || pillHost.contains(target))) {
          continue;
        }
        scheduleScan();
        return;
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "title", "data-tooltip", "class"]
    });
  }

  // Start immediately with default settings so initial render does not flash .md cards.
  ensureStyleInjected();
  startObserver();
  scheduleScan();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      autoPageSteps = 0;
      scheduleScan();
    });
  }

  window.addEventListener(
    "scroll",
    function (event) {
      if (event && event.isTrusted) {
        autoPageSteps = 0;
      }
    },
    { passive: true }
  );

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(Core.STORAGE_KEYS, function (stored) {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      var result = Core.migrateStoredSettings(stored);
      applyLoadedSettings(result.settings);
      if (result.migrated) {
        chrome.storage.local.set(result.settings);
      }
    });

    chrome.storage.onChanged.addListener(function (changes, areaName) {
      if (areaName !== "local") {
        return;
      }
      var next = {
        enabled:
          changes.enabled !== undefined ? changes.enabled.newValue : settings.enabled,
        extensions:
          changes.extensions !== undefined
            ? changes.extensions.newValue
            : settings.extensions,
        showPill:
          changes.showPill !== undefined ? changes.showPill.newValue : settings.showPill
      };
      applyLoadedSettings(next);
    });
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
      if (!message || message.type !== "md-block:get-status") {
        return false;
      }
      if (surface !== "homescreen") {
        return false;
      }
      sendResponse({
        surface: surface,
        enabled: settings.enabled,
        hiddenCount: lastStats.hiddenCount,
        visibleDocCount: lastStats.visibleDocCount,
        hiddenByExt: lastStats.hiddenByExt
      });
      return false;
    });
  }
})();
