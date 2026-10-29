"use strict";

chrome.runtime.onMessage.addListener(function (message, sender) {
  if (!message || message.type !== "md-block:badge") {
    return;
  }
  var tabId = sender && sender.tab && sender.tab.id;
  if (typeof tabId !== "number") {
    return;
  }

  if (!message.enabled) {
    var offText =
      (chrome.i18n && chrome.i18n.getMessage("badgeOff")) || "OFF";
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#d9822b" });
    chrome.action.setBadgeText({ tabId: tabId, text: offText });
    return;
  }

  var count = Number(message.hiddenCount) || 0;
  if (count <= 0) {
    chrome.action.setBadgeText({ tabId: tabId, text: "" });
    return;
  }

  var label = count > 999 ? "999+" : String(count);
  chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#5f6368" });
  chrome.action.setBadgeText({ tabId: tabId, text: label });
});
