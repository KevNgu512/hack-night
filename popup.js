// Load saved keywords and settings
chrome.storage.sync.get(['keywords', 'checkComments', 'filteredCount'], (data) => {
  if (data.keywords && data.keywords.length > 0) {
    displayKeywords(data.keywords);
  }
  if (data.checkComments) {
    document.getElementById('checkComments').checked = true;
  }
  if (data.filteredCount) {
    document.getElementById('stats').textContent = `Posts filtered: ${data.filteredCount}`;
  }
});

// Add keywords
document.getElementById('addBtn').addEventListener('click', addKeywords);
document.getElementById('keywordInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addKeywords();
});

function addKeywords() {
  const input = document.getElementById('keywordInput');
  const newKeywords = input.value
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0);
  
  if (newKeywords.length === 0) return;

  chrome.storage.sync.get(['keywords'], (data) => {
    const existing = data.keywords || [];
    const updated = [...new Set([...existing, ...newKeywords])]; // Remove duplicates
    
    chrome.storage.sync.set({ keywords: updated }, () => {
      displayKeywords(updated);
      input.value = '';
      
      // Notify content script to refresh
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'updateKeywords', keywords: updated});
        }
      });
    });
  });
}

function displayKeywords(keywords) {
  const container = document.getElementById('keywordsList');
  
  if (keywords.length === 0) {
    container.innerHTML = '<span style="color: #8e8e8e;">No keywords added yet</span>';
    return;
  }
  
  container.innerHTML = keywords.map(keyword => 
    `<span class="keyword-tag">
      ${keyword}
      <span class="remove-btn" data-keyword="${keyword}">×</span>
    </span>`
  ).join('');
  
  // Add remove handlers
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const keywordToRemove = e.target.dataset.keyword;
      removeKeyword(keywordToRemove);
    });
  });
}

function removeKeyword(keyword) {
  chrome.storage.sync.get(['keywords'], (data) => {
    const updated = (data.keywords || []).filter(k => k !== keyword);
    chrome.storage.sync.set({ keywords: updated }, () => {
      displayKeywords(updated);
      
      // Notify content script
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'updateKeywords', keywords: updated});
        }
      });
    });
  });
}

// Handle comment checking toggle
document.getElementById('checkComments').addEventListener('change', (e) => {
  chrome.storage.sync.set({ checkComments: e.target.checked }, () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'updateSettings'});
      }
    });
  });
});