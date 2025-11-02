// ============================================
// GLOBAL VARIABLES
// ============================================
let keywords = [];
let checkComments = false;
let partialHashtagMatch = false;
let filteredCount = 0;
const DEBUG = true;

// ============================================
// DEBUG HELPER FUNCTIONS
// ============================================
function debugLog(message, ...args) {
  if (DEBUG) {
    console.log(`[SPOILER FILTER DEBUG] ${message}`, ...args);
  }
}

function debugElement(element, label = "Element") {
  if (!DEBUG) return;

  console.group(`[SPOILER FILTER DEBUG] ${label}`);
  console.log("Tag name:", element.tagName);
  console.log("Classes:", element.className);
  console.log("ID:", element.id);
  console.log("Role:", element.getAttribute("role"));
  console.log("Dimensions:", {
    width: element.offsetWidth,
    height: element.offsetHeight,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight
  });
  console.log("Position:", window.getComputedStyle(element).position);
  console.log("Display:", window.getComputedStyle(element).display);
  console.log("Text content (first 200 chars):", element.innerText.substring(0, 200));
  console.log("HTML structure (first level):");
  Array.from(element.children).slice(0, 5).forEach((child, i) => {
    console.log(`  Child ${i}:`, child.tagName, child.className);
  });
  console.log("Full element:", element);
  console.groupEnd();
}

// ============================================
// LOAD SAVED SETTINGS FROM CHROME STORAGE
// ============================================
debugLog("\n🚀 Instagram Spoiler Filter Extension Loading...");
debugLog("Current URL:", window.location.href);

chrome.storage.sync.get(
  ["keywords", "checkComments", "partialHashtagMatch", "filteredCount"],
  (data) => {
    keywords = data.keywords || [];
    checkComments = data.checkComments || false;
    partialHashtagMatch = data.partialHashtagMatch || false;
    filteredCount = data.filteredCount || 0;

    debugLog("\n=== SETTINGS LOADED ===");
    debugLog("Keywords:", keywords);
    debugLog("Check comments:", checkComments);
    debugLog("Partial hashtag match:", partialHashtagMatch);
    debugLog("Total filtered count:", filteredCount);

    debugLog("\n⏱️ Scheduling initial scan in 2 seconds...");
    setTimeout(() => {
      debugLog("⏱️ 2 seconds elapsed - starting initial scan");
      scanPage();
    }, 2000);
  }
);

// ============================================
// LISTEN FOR MESSAGES FROM POPUP
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog("\n📨 Message received from popup:", message);

  if (message.action === "updateKeywords") {
    keywords = message.keywords;
    debugLog("Keywords updated to:", keywords);
    debugLog("Triggering rescan...");
    scanPage();

  } else if (message.action === "updateSettings") {
    debugLog("Settings update requested");
    chrome.storage.sync.get(["checkComments", "partialHashtagMatch"], (data) => {
      checkComments = data.checkComments || false;
      partialHashtagMatch = data.partialHashtagMatch || false;
      debugLog("Settings updated:");
      debugLog("  checkComments:", checkComments);
      debugLog("  partialHashtagMatch:", partialHashtagMatch);
      debugLog("Triggering rescan...");
      scanPage();
    });
  }
});

// ============================================
// MUTATION OBSERVER - WATCH FOR NEW CONTENT
// ============================================
let mutationCount = 0;
let lastScanTime = 0;
const SCAN_THROTTLE = 1000;

const observer = new MutationObserver((mutations) => {
  mutationCount++;

  const now = Date.now();
  if (now - lastScanTime < SCAN_THROTTLE) {
    debugLog(`⏭️ Skipping scan (throttled) - mutation ${mutationCount}`);
    return;
  }

  debugLog(`\n🔄 Mutation detected (mutation #${mutationCount})`);
  debugLog(`Mutations in this batch: ${mutations.length}`);
  debugLog("Triggering scan...");

  lastScanTime = now;
  scanPage();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

debugLog("✓ Mutation observer active");

// ============================================
// MAIN FUNCTION: SCAN PAGE FOR SPOILERS
// ============================================
function scanPage() {
  if (keywords.length === 0) {
    console.log("No keywords to filter");
    return;
  }

  console.log("Scanning page for spoilers...");

  const possibleSelectors = [
    'article[role="presentation"]',
    "article",
    'div[role="button"] article',
    "main article",
    '[class*="post"]',
    'div[class*="_ac7v"]',
    'div[class*="x1ned7t2"]',
    'div[class*="_aatk"]',
    'div[class*="_aava"]',
    'main section > div > div > div',
    'div[role="presentation"]',
  ];

  const postsSet = new Set();
  const selectorMatches = {};

  debugLog("=== STARTING ELEMENT SEARCH ===");
  debugLog(`Current URL: ${window.location.href}`);
  debugLog(`Testing ${possibleSelectors.length} selectors...`);

  for (const selector of possibleSelectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      debugLog(`✓ Selector "${selector}" found ${elements.length} elements`);
      selectorMatches[selector] = elements.length;

      if (DEBUG && elements.length > 0) {
        debugElement(elements[0], `First match for "${selector}"`);
      }

      elements.forEach(el => postsSet.add(el));
    } else {
      debugLog(`✗ Selector "${selector}" found 0 elements`);
    }
  }

  const posts = Array.from(postsSet);

  debugLog("=== SEARCH RESULTS ===");
  debugLog(`Total unique posts/reels found: ${posts.length}`);
  debugLog("Matches per selector:", selectorMatches);

  if (posts.length === 0) {
    debugLog("⚠️ No posts found on page - stopping scan");
    return;
  }

  debugLog(`Processing ${posts.length} unique elements...`);

  posts.forEach((post, index) => {
    if (post.dataset.spoilerChecked) {
      debugLog(`Skipping post ${index} - already checked`);
      return;
    }
    post.dataset.spoilerChecked = "true";

    debugLog(`\n=== CHECKING POST/REEL ${index} ===`);
    debugElement(post, `Post/Reel ${index}`);

    let containsSpoiler = false;
    let spoilerText = "";
    let detectionMethod = "";

    const moreButtons = post.querySelectorAll('[role="button"]');
    debugLog(`Found ${moreButtons.length} buttons in post`);

    moreButtons.forEach((btn, btnIdx) => {
      const btnText = btn.textContent.toLowerCase();
      if (btnText.includes('more') || btnText.includes('…')) {
        debugLog(`  Button ${btnIdx} might be a "more" button: "${btn.textContent.substring(0, 30)}"`);
      }
    });

    const allText = post.innerText.toLowerCase();
    debugLog(`\nText content length: ${allText.length} chars`);
    debugLog(`Text preview: "${allText.substring(0, 150)}..."`);

    if (allText.includes('… more') || allText.includes('...more')) {
      debugLog(`⚠️ Content appears to be truncated (contains "... more")`);
      debugLog(`This may hide hashtags and full text content`);
    }

    debugLog(`Checking against ${keywords.length} keywords:`, keywords);

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      if (allText.includes(keywordLower)) {
        containsSpoiler = true;
        spoilerText = keyword;
        detectionMethod = "text content";
        debugLog(`✓ SPOILER DETECTED in post ${index}! Keyword: "${keyword}" (method: text content)`);
        break;
      } else {
        debugLog(`✗ Keyword "${keyword}" not found in text content`);
      }
    }

    const hashtagSelectors = [
      'a[href*="/explore/tags/"]',
      'a[href*="/tags/"]',
      'a[href*="explore"][href*="tags"]',
      'a._aa9_._a6hd',
    ];

    let hashtags = [];
    debugLog(`\nSearching for hashtags with ${hashtagSelectors.length} different selectors...`);

    for (const selector of hashtagSelectors) {
      const found = post.querySelectorAll(selector);
      if (found.length > 0) {
        debugLog(`  ✓ Selector "${selector}" found ${found.length} hashtags`);
        hashtags = found;
        break;
      } else {
        debugLog(`  ✗ Selector "${selector}" found 0 hashtags`);
      }
    }

    const allLinks = post.querySelectorAll('a[href]');
    debugLog(`Total links found in post: ${allLinks.length}`);
    if (DEBUG && allLinks.length > 0) {
      debugLog(`Sample of link hrefs (first 5):`);
      Array.from(allLinks).slice(0, 5).forEach((link, i) => {
        debugLog(`  Link ${i}: ${link.href} - Text: "${link.textContent.substring(0, 30)}"`);
      });
    }

    debugLog(`Found ${hashtags.length} hashtags in post ${index}`);
    if (hashtags.length > 0) {
      const hashtagTexts = Array.from(hashtags).map(tag => tag.textContent);
      debugLog(`Hashtags:`, hashtagTexts);
    }

    hashtags.forEach((tag, tagIndex) => {
      const tagText = tag.textContent.toLowerCase().replace('#', '');
      debugLog(`  Checking hashtag ${tagIndex}: "#${tagText}"`);

      keywords.forEach((keyword) => {
        const keywordLower = keyword.toLowerCase();

        if (partialHashtagMatch) {
          if (tagText.includes(keywordLower)) {
            containsSpoiler = true;
            spoilerText = keyword;
            detectionMethod = "partial hashtag match";
            debugLog(`  ✓ SPOILER DETECTED! Partial hashtag match: "${keyword}" in "#${tagText}"`);
          } else {
            debugLog(`  ✗ No partial match: "${keyword}" not in "#${tagText}"`);
          }
        } else {
          if (tagText === keywordLower) {
            containsSpoiler = true;
            spoilerText = keyword;
            detectionMethod = "exact hashtag match";
            debugLog(`  ✓ SPOILER DETECTED! Exact hashtag match: "${keyword}" = "#${tagText}"`);
          } else {
            debugLog(`  ✗ No exact match: "${keyword}" != "#${tagText}"`);
          }
        }
      });
    });

    if (containsSpoiler) {
      debugLog(`\n🚨 SPOILER FOUND in post ${index}!`);
      debugLog(`  Keyword: "${spoilerText}"`);
      debugLog(`  Detection method: ${detectionMethod}`);
      debugLog(`  Attempting to blur post...`);

      blurPost(post, spoilerText);

      filteredCount++;
      chrome.storage.sync.set({ filteredCount });

      debugLog(`  ✓ Blur applied successfully`);
      debugLog(`  Total filtered count: ${filteredCount}`);
    } else {
      debugLog(`✓ Post ${index} is clean - no spoilers detected`);
    }
  });

  debugLog("\n=== SCAN COMPLETE ===");
}

// ============================================
// BLUR POST FUNCTION: ADD WARNING OVERLAY
// ============================================
function blurPost(post, keyword) {
  debugLog(`\n=== BLURRING POST ===`);
  debugLog(`Keyword: "${keyword}"`);

  if (post.querySelector(".spoiler-overlay")) {
    debugLog("⚠️ Post already has overlay - skipping");
    return;
  }

  debugElement(post, "Post being blurred");

  const overlay = document.createElement("div");
  overlay.className = "spoiler-overlay";
  debugLog("Created overlay element");

  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    min-height: 400px;
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
    border-radius: inherit;
  `;

  // ✅ **CHANGE**: The "Hide Post" button has been removed from the HTML below.
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
  `;

  const currentPosition = window.getComputedStyle(post).position;
  debugLog(`Post position before adjustment: ${currentPosition}`);

  if (currentPosition === 'static') {
    post.style.position = "relative";
    debugLog("Changed post position to: relative");
  }

  const beforeDimensions = {
    offsetWidth: post.offsetWidth,
    offsetHeight: post.offsetHeight,
    clientWidth: post.clientWidth,
    clientHeight: post.clientHeight,
    scrollHeight: post.scrollHeight
  };
  debugLog("Post dimensions before overlay:", beforeDimensions);

  const currentOverflow = window.getComputedStyle(post).overflow;
  debugLog(`Post overflow before adjustment: ${currentOverflow}`);
  post.style.overflow = "hidden";

  const postHeight = post.offsetHeight;
  if (postHeight < 400) {
    debugLog(`⚠️ Post height (${postHeight}px) is too small, setting min-height to 400px`);
    post.style.minHeight = "400px";
  } else {
    debugLog(`Post height (${postHeight}px) is adequate`);
  }

  post.appendChild(overlay);
  debugLog("✓ Overlay appended to post");

  const overlayCheck = post.querySelector(".spoiler-overlay");
  if (overlayCheck) {
    debugLog("✓ Overlay successfully found in DOM");
    debugLog("Overlay dimensions:", {
      offsetWidth: overlay.offsetWidth,
      offsetHeight: overlay.offsetHeight,
      computedDisplay: window.getComputedStyle(overlay).display,
      computedPosition: window.getComputedStyle(overlay).position,
      computedZIndex: window.getComputedStyle(overlay).zIndex
    });
  } else {
    debugLog("❌ ERROR: Overlay not found in DOM after appending!");
  }

  const showBtn = overlay.querySelector(".show-anyway-btn");
  if (showBtn) {
    showBtn.addEventListener("click", (e) => {
      debugLog("'Show Anyway' button clicked");
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      overlay.remove();
      debugLog("✓ Overlay removed - post now visible");
    }, true);
    debugLog("✓ 'Show Anyway' button listener attached");
  } else {
    debugLog("❌ ERROR: 'Show Anyway' button not found!");
  }

  // ✅ **CHANGE**: The event listener for the "Hide Post" button has been removed.

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      debugLog("Overlay background clicked (not a button)");
      e.stopPropagation();
    }
  }, true);

  debugLog("=== BLUR COMPLETE ===\n");
}

// ============================================
// INITIALIZATION
// ============================================
debugLog("\n✅ Instagram Spoiler Filter READY!");
debugLog("Extension is now monitoring the page for spoilers");

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    debugLog(`\n🔀 URL CHANGE DETECTED`);
    debugLog(`  From: ${lastUrl}`);
    debugLog(`  To: ${url}`);

    lastUrl = url;

    debugLog("⏱️ Scheduling scan in 1 second (SPA navigation)...");
    setTimeout(() => {
      debugLog("⏱️ 1 second elapsed - scanning after navigation");
      scanPage();
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });

debugLog("✓ URL change observer active");