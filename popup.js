// ============================================
// LOAD AND DISPLAY CURRENT SETTINGS
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  // Load saved settings from Chrome storage
  chrome.storage.sync.get(
    ["keywords", "checkComments", "partialHashtagMatch", "filteredCount"],
    (data) => {
      // Load keywords
      const keywords = data.keywords || [];
      displayKeywords(keywords);
      
      // Load checkbox states
      document.getElementById("checkComments").checked = data.checkComments || false;
      document.getElementById("partialHashtagMatch").checked = data.partialHashtagMatch || false;
      
      // Load filtered count
      document.getElementById("stats").textContent = `Posts filtered: ${data.filteredCount || 0}`;
    }
  );
  
  // ============================================
  // ADD KEYWORDS BUTTON HANDLER
  // ============================================
  document.getElementById("addBtn").addEventListener("click", addKeywords);
  
  // Allow Enter key to add keywords
  document.getElementById("keywordInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addKeywords();
    }
  });
  
  // ============================================
  // CHECKBOX CHANGE HANDLERS
  // ============================================
  document.getElementById("checkComments").addEventListener("change", (e) => {
    chrome.storage.sync.set({ checkComments: e.target.checked }, () => {
      console.log("Check comments setting saved:", e.target.checked);
      notifyContentScript();
    });
  });
  
  document.getElementById("partialHashtagMatch").addEventListener("change", (e) => {
    chrome.storage.sync.set({ partialHashtagMatch: e.target.checked }, () => {
      console.log("Partial hashtag match setting saved:", e.target.checked);
      notifyContentScript();
    });
  });
});

// ============================================
// ADD KEYWORDS FUNCTION
// ============================================
function addKeywords() {
  const input = document.getElementById("keywordInput");
  const newKeywordsText = input.value.trim();
  
  if (!newKeywordsText) {
    return; // Don't add empty keywords
  }
  
  // Split by commas and clean up each keyword
  const newKeywords = newKeywordsText
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0);
  
  if (newKeywords.length === 0) {
    return;
  }
  
  // Get existing keywords from storage
  chrome.storage.sync.get(["keywords"], (data) => {
    let keywords = data.keywords || [];
    
    // Add new keywords (avoid duplicates)
    newKeywords.forEach((keyword) => {
      if (!keywords.includes(keyword)) {
        keywords.push(keyword);
      }
    });
    
    // Save updated keywords
    chrome.storage.sync.set({ keywords }, () => {
      console.log("Keywords saved:", keywords);
      displayKeywords(keywords);
      input.value = ""; // Clear input field
      notifyContentScript();
    });
  });
}

// ============================================
// DISPLAY KEYWORDS IN UI
// ============================================
function displayKeywords(keywords) {
  const container = document.getElementById("keywordsList");
  
  if (keywords.length === 0) {
    container.innerHTML = '<span style="color: #8e8e8e;">No keywords added yet</span>';
    return;
  }
  
  // Create keyword tags with remove buttons
  container.innerHTML = keywords
    .map(
      (keyword) => `
      <span class="keyword-tag">
        ${escapeHtml(keyword)}
        <span class="remove-btn" data-keyword="${escapeHtml(keyword)}">×</span>
      </span>
    `
    )
    .join("");
  
  // Add click handlers to remove buttons
  container.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeKeyword(btn.dataset.keyword);
    });
  });
}

// ============================================
// REMOVE KEYWORD FUNCTION
// ============================================
function removeKeyword(keywordToRemove) {
  chrome.storage.sync.get(["keywords"], (data) => {
    let keywords = data.keywords || [];
    
    // Filter out the keyword to remove
    keywords = keywords.filter((k) => k !== keywordToRemove);
    
    // Save updated keywords
    chrome.storage.sync.set({ keywords }, () => {
      console.log("Keyword removed:", keywordToRemove);
      displayKeywords(keywords);
      notifyContentScript();
    });
  });
}

// ============================================
// NOTIFY CONTENT SCRIPT OF CHANGES
// ============================================
function notifyContentScript() {
  // Get current keywords to send to content script
  chrome.storage.sync.get(["keywords"], (data) => {
    // Send message to all Instagram tabs
    chrome.tabs.query({ url: "*://*.instagram.com/*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          action: "updateKeywords",
          keywords: data.keywords || [],
        });
        chrome.tabs.sendMessage(tab.id, {
          action: "updateSettings",
        });
      });
    });
  });
}

// ============================================
// UTILITY: ESCAPE HTML TO PREVENT XSS
// ============================================
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}