(function () {
  "use strict";

  var Core = globalThis.MdBlockCore;
  if (!Core) {
    return;
  }

  var toggleEnabledEl = document.getElementById("toggle-enabled");
  var togglePillEl = document.getElementById("toggle-pill");
  var tabStatusEl = document.getElementById("tab-status");
  var presetListEl = document.getElementById("preset-list");
  var customFormEl = document.getElementById("custom-form");
  var customInputEl = document.getElementById("custom-input");
  var customErrorEl = document.getElementById("custom-error");
  var customChipsEl = document.getElementById("custom-chips");

  var settings = Core.normalizeSettings(Core.DEFAULT_SETTINGS);

  var presetExtMap = Object.create(null);
  for (var i = 0; i < Core.OPTIONAL_PRESETS.length; i += 1) {
    var exts = Core.OPTIONAL_PRESETS[i].extensions;
    for (var j = 0; j < exts.length; j += 1) {
      presetExtMap[exts[j]] = true;
    }
  }

  function applyStaticLocalization() {
    if (chrome && chrome.i18n && typeof chrome.i18n.getUILanguage === "function") {
      document.documentElement.lang = chrome.i18n.getUILanguage();
    }

    var textNodes = document.querySelectorAll("[data-i18n]");
    for (var t = 0; t < textNodes.length; t += 1) {
      var el = textNodes[t];
      el.textContent = Core.getMessage(el.getAttribute("data-i18n"));
    }

    var titleNodes = document.querySelectorAll("[data-i18n-title]");
    for (var ti = 0; ti < titleNodes.length; ti += 1) {
      var titleEl = titleNodes[ti];
      titleEl.title = Core.getMessage(titleEl.getAttribute("data-i18n-title"));
    }

    var placeholderNodes = document.querySelectorAll("[data-i18n-placeholder]");
    for (var p = 0; p < placeholderNodes.length; p += 1) {
      var phEl = placeholderNodes[p];
      phEl.placeholder = Core.getMessage(phEl.getAttribute("data-i18n-placeholder"));
    }

    var ariaNodes = document.querySelectorAll("[data-i18n-aria-label]");
    for (var a = 0; a < ariaNodes.length; a += 1) {
      var ariaEl = ariaNodes[a];
      ariaEl.setAttribute(
        "aria-label",
        Core.getMessage(ariaEl.getAttribute("data-i18n-aria-label"))
      );
    }
  }

  function saveSettings() {
    chrome.storage.local.set({
      enabled: settings.enabled,
      extensions: settings.extensions,
      showPill: settings.showPill,
      settingsVersion: Core.SETTINGS_VERSION
    });
  }

  function hasAllExtensions(extList) {
    var active = Core.toExtensionSet(settings.extensions);
    for (var k = 0; k < extList.length; k += 1) {
      if (!active[extList[k]]) {
        return false;
      }
    }
    return true;
  }

  function setExtensionsMembership(extList, shouldInclude) {
    var next = settings.extensions.slice();
    if (shouldInclude) {
      for (var k = 0; k < extList.length; k += 1) {
        if (next.indexOf(extList[k]) === -1) {
          next.push(extList[k]);
        }
      }
    } else {
      next = next.filter(function (item) {
        return extList.indexOf(item) === -1;
      });
    }
    settings.extensions = Core.normalizeExtensionList(next);
    saveSettings();
    render();
    refreshActiveTabStatus();
  }

  function renderPresets() {
    presetListEl.textContent = "";
    for (var p = 0; p < Core.OPTIONAL_PRESETS.length; p += 1) {
      (function (preset) {
        var row = document.createElement("label");
        row.className = "checkbox-row";

        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = hasAllExtensions(preset.extensions);
        checkbox.addEventListener("change", function () {
          setExtensionsMembership(preset.extensions, checkbox.checked);
        });

        var codeSpan = document.createElement("span");
        codeSpan.className = "preset-code";
        codeSpan.textContent = preset.label;

        var noteSpan = document.createElement("span");
        noteSpan.className = "preset-note";
        noteSpan.textContent = preset.noteKey
          ? Core.getMessage(preset.noteKey)
          : preset.note;

        row.appendChild(checkbox);
        row.appendChild(codeSpan);
        row.appendChild(noteSpan);
        presetListEl.appendChild(row);
      })(Core.OPTIONAL_PRESETS[p]);
    }
  }

  function renderCustomChips() {
    customChipsEl.textContent = "";
    var customExts = settings.extensions.filter(function (ext) {
      return !presetExtMap[ext];
    });

    for (var c = 0; c < customExts.length; c += 1) {
      (function (ext) {
        var chip = document.createElement("span");
        chip.className = "chip";

        var label = document.createElement("span");
        label.textContent = "." + ext;

        var removeLabel = Core.getMessage("chipRemoveLabel", [ext]);
        var removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "chip-remove";
        removeBtn.title = removeLabel;
        removeBtn.setAttribute("aria-label", removeLabel);
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", function () {
          setExtensionsMembership([ext], false);
        });

        chip.appendChild(label);
        chip.appendChild(removeBtn);
        customChipsEl.appendChild(chip);
      })(customExts[c]);
    }
  }

  function render() {
    toggleEnabledEl.checked = settings.enabled;
    togglePillEl.checked = settings.showPill;
    renderPresets();
    renderCustomChips();
  }

  function showCustomError(text) {
    if (!text) {
      customErrorEl.hidden = true;
      customErrorEl.textContent = "";
      return;
    }
    customErrorEl.textContent = text;
    customErrorEl.hidden = false;
  }

  function refreshActiveTabStatus() {
    if (!chrome.tabs || !chrome.tabs.query) {
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || typeof tab.id !== "number") {
        return;
      }
      chrome.tabs.sendMessage(
        tab.id,
        { type: "md-block:get-status" },
        function (response) {
          if (chrome.runtime.lastError || !response) {
            tabStatusEl.textContent = settings.enabled
              ? Core.getMessage("popupStatusDefault")
              : Core.getMessage("popupStatusPaused");
            return;
          }
          var label = Core.formatPillLabel(response, response.enabled);
          tabStatusEl.textContent = Core.getMessage("popupStatusOnTab", [label]);
        }
      );
    });
  }

  applyStaticLocalization();

  toggleEnabledEl.addEventListener("change", function () {
    settings.enabled = toggleEnabledEl.checked;
    saveSettings();
    setTimeout(refreshActiveTabStatus, 60);
  });

  togglePillEl.addEventListener("change", function () {
    settings.showPill = togglePillEl.checked;
    saveSettings();
  });

  customFormEl.addEventListener("submit", function (event) {
    event.preventDefault();
    var raw = customInputEl.value || "";
    var normalized = Core.normalizeExtension(raw);
    if (!normalized) {
      showCustomError(Core.getMessage("customErrorInvalid"));
      return;
    }
    showCustomError("");
    customInputEl.value = "";
    setExtensionsMembership([normalized], true);
  });

  chrome.storage.local.get(Core.STORAGE_KEYS, function (stored) {
    var result = Core.migrateStoredSettings(stored);
    settings = result.settings;
    if (result.migrated) {
      saveSettings();
    }
    render();
    refreshActiveTabStatus();
  });

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName !== "local") {
      return;
    }
    settings = Core.normalizeSettings({
      enabled:
        changes.enabled !== undefined ? changes.enabled.newValue : settings.enabled,
      extensions:
        changes.extensions !== undefined
          ? changes.extensions.newValue
          : settings.extensions,
      showPill:
        changes.showPill !== undefined ? changes.showPill.newValue : settings.showPill
    });
    render();
    refreshActiveTabStatus();
  });
})();
