// ============================================
// GLOBAL VARIABLES
// ============================================
let keywords = [];
let checkComments = false;
let partialHashtagMatch = false; // NEW: Enable partial matching for hashtags
let filteredCount = 0;

// ============================================
// LOAD SAVED SETTINGS FROM CHROME STORAGE
// ============================================
chrome.storage.sync.get(
  ["keywords", "checkComments", "partialHashtagMatch", "filteredCount"],
  (data) => {
    keywords = data.keywords || [];
    checkComments = data.checkComments || false;
    partialHashtagMatch = data.partialHashtagMatch || false; // NEW
    filteredCount = data.filteredCount || 0;
    
    console.log("Spoiler filter loaded with keywords:", keywords);
    console.log("Check comments enabled:", checkComments);
    console.log("Partial hashtag match enabled:", partialHashtagMatch); // NEW
    
    setTimeout(scanPage, 2000);
  }
);

// ============================================
// LISTEN FOR MESSAGES FROM POPUP
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateKeywords") {
    keywords = message.keywords;
    console.log("Keywords updated:", keywords);
    scanPage();
    
  } else if (message.action === "updateSettings") {
    chrome.storage.sync.get(["checkComments", "partialHashtagMatch"], (data) => {
      checkComments = data.checkComments || false;
      partialHashtagMatch = data.partialHashtagMatch || false; // NEW
      console.log("Settings updated, checkComments:", checkComments);
      console.log("Settings updated, partialHashtagMatch:", partialHashtagMatch); // NEW
      scanPage();
    });
  }
});

// ============================================
// MUTATION OBSERVER - WATCH FOR NEW CONTENT
// ============================================
const observer = new MutationObserver((mutations) => {
  scanPage();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// ============================================
// MAIN FUNCTION: SCAN PAGE FOR SPOILERS
// ============================================
function scanPage() {
  if (keywords.length === 0) {
    console.log("No keywords to filter");
    return;
  }
  
  console.log("Scanning page for spoilers...");
  
  // ============================================
  // FIND INSTAGRAM POSTS AND REELS
  // ============================================
  // Updated selectors to include Reels
  const possibleSelectors = [
    'article[role="presentation"]',     // Regular posts
    "article",                           // Generic article tags
    'div[role="button"] article',       // Posts inside button divs
    "main article",                      // Articles inside main
    '[class*="post"]',                   // Any element with "post" in class
    'div[class*="_ac7v"]',              // Reels container (Instagram class)
    'div[class*="x1ned7t2"]',           // Another Reels container
    'section > div > div',              // Reels in feed
  ];
  
  let posts = [];
  for (const selector of possibleSelectors) {
    posts = document.querySelectorAll(selector);
    if (posts.length > 0) {
      console.log(`Found ${posts.length} posts/reels using selector: ${selector}`);
      break;
    }
  }
  
  if (posts.length === 0) {
    console.log("No posts found on page");
    return;
  }
  
  // ============================================
  // CHECK EACH POST FOR SPOILERS
  // ============================================
  posts.forEach((post, index) => {
    if (post.dataset.spoilerChecked) return;
    post.dataset.spoilerChecked = "true";
    
    let containsSpoiler = false;
    let spoilerText = "";
    
    // ============================================
    // METHOD 1: CHECK ALL TEXT CONTENT
    // ============================================
    const allText = post.innerText.toLowerCase();
    
    for (const keyword of keywords) {
      if (allText.includes(keyword.toLowerCase())) {
        containsSpoiler = true;
        spoilerText = keyword;
        console.log(`Post ${index} contains spoiler keyword: "${keyword}"`);
        break;
      }
    }
    
    // ============================================
    // METHOD 2: CHECK HASHTAGS
    // ============================================
    const hashtags = post.querySelectorAll(
      'a[href*="/explore/tags/"], a[href*="/tags/"]'
    );
    
    hashtags.forEach((tag) => {
      const tagText = tag.textContent.toLowerCase().replace('#', '');
      
      keywords.forEach((keyword) => {
        const keywordLower = keyword.toLowerCase();
        
        // Check if partial matching is enabled
        if (partialHashtagMatch) {
          // Partial match: "gym" matches "gymtok", "gymrat", etc.
          if (tagText.includes(keywordLower)) {
            containsSpoiler = true;
            spoilerText = keyword;
            console.log(`Post ${index} has partial hashtag match: "${keyword}" in "#${tagText}"`);
          }
        } else {
          // Exact match only: "gym" only matches "#gym"
          if (tagText === keywordLower) {
            containsSpoiler = true;
            spoilerText = keyword;
            console.log(`Post ${index} has exact hashtag match: "${keyword}"`);
          }
        }
      });
    });
    
    // ============================================
    // IF SPOILER FOUND: BLUR THE POST
    // ============================================
    if (containsSpoiler) {
      console.log(`Blurring post ${index} due to keyword: "${spoilerText}"`);
      blurPost(post, spoilerText);
      
      filteredCount++;
      chrome.storage.sync.set({ filteredCount });
    }
  });
}

// ============================================
// BLUR POST FUNCTION: ADD WARNING OVERLAY
// ============================================
function blurPost(post, keyword) {
  if (post.querySelector(".spoiler-overlay")) {
    return;
  }
  
  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "spoiler-overlay";
  
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    text-align: center;
    padding: 20px;
    box-sizing: border-box;
  `;
  
  overlay.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
      Potential Spoiler Detected
    </div>
    <div style="font-size: 14px; color: #ccc; margin-bottom: 20px;">
      Contains: "${keyword}"
    </div>
    <button class="show-anyway-btn" style="
      background: #0095f6;
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      margin: 5px;
      position: relative;
      z-index: 1000000;
    ">Show Anyway</button>
    <button class="hide-post-btn" style="
      background: transparent;
      color: white;
      border: 1px solid white;
      padding: 10px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      margin: 5px;
      position: relative;
      z-index: 1000000;
    ">Hide Post</button>
  `;
  
  // Make sure post container is relative
  const currentPosition = window.getComputedStyle(post).position;
  if (currentPosition === 'static') {
    post.style.position = "relative";
  }
  
  post.appendChild(overlay);
  
  // ============================================
  // IMPROVED BUTTON CLICK HANDLERS
  // ============================================
  // "Show Anyway" button
  const showBtn = overlay.querySelector(".show-anyway-btn");
  showBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation(); // Extra stop for nested handlers
    overlay.remove();
    console.log("User chose to show post anyway");
  }, true); // Use capture phase
  
  // "Hide Post" button
  const hideBtn = overlay.querySelector(".hide-post-btn");
  hideBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    post.style.display = "none";
    console.log("User chose to hide post");
  }, true); // Use capture phase
  
  // Also prevent clicks on the overlay itself from propagating
  overlay.addEventListener("click", (e) => {
    // Only stop propagation if clicking the overlay background, not buttons
    if (e.target === overlay) {
      e.stopPropagation();
    }
  }, true);
}

// ============================================
// INITIALIZATION
// ============================================
console.log("Instagram Spoiler Filter active!");
console.log("Current URL:", window.location.href);

// Also scan when navigating within Instagram (SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log("URL changed to:", url);
    setTimeout(scanPage, 1000); // Scan after navigation
  }
}).observe(document, { subtree: true, childList: true });