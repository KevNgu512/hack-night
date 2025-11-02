// ============================================
// GLOBAL VARIABLES
// ============================================
// These variables store the extension's state and settings

// Array to hold user's spoiler keywords (e.g., ["stranger things", "season 5"])
let keywords = [];

// Boolean flag: should we also scan comments for spoilers?
let checkComments = false;

// Counter: how many posts have been filtered/blurred so far
let filteredCount = 0;

// ============================================
// LOAD SAVED SETTINGS FROM CHROME STORAGE
// ============================================
// When the extension loads, retrieve user's saved settings
chrome.storage.sync.get(
  ["keywords", "checkComments", "filteredCount"], // Request these three values from storage
  (data) => {
    // This callback function runs when Chrome returns the stored data
    
    // If keywords exist in storage, use them; otherwise default to empty array
    keywords = data.keywords || [];
    
    // If checkComments setting exists, use it; otherwise default to false
    checkComments = data.checkComments || false;
    
    // If filteredCount exists, use it; otherwise default to 0
    filteredCount = data.filteredCount || 0;
    
    // Log to console so we can debug and see what was loaded
    console.log("Spoiler filter loaded with keywords:", keywords);
    console.log("Check comments enabled:", checkComments);

    // Wait 2 seconds (2000ms) before first scan to let Instagram fully load
    // Instagram loads content dynamically, so we need to wait for it
    setTimeout(scanPage, 2000);
  }
);

// ============================================
// LISTEN FOR MESSAGES FROM POPUP
// ============================================
// When user updates keywords in the popup, the popup sends a message here
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check what action the popup is requesting
  if (message.action === "updateKeywords") {
    // User added/removed keywords in popup
    keywords = message.keywords; // Update our local keywords array
    console.log("Keywords updated:", keywords);
    scanPage(); // Re-scan the page with new keywords
    
  } else if (message.action === "updateSettings") {
    // User toggled the "check comments" checkbox
    // Need to fetch the latest setting from storage
    chrome.storage.sync.get(["checkComments"], (data) => {
      checkComments = data.checkComments || false;
      console.log("Settings updated, checkComments:", checkComments);
      scanPage(); // Re-scan page with new settings
    });
  }
});

// ============================================
// MUTATION OBSERVER - WATCH FOR NEW CONTENT
// ============================================
// Instagram uses infinite scroll, so new posts load as you scroll
// MutationObserver watches for changes in the page's HTML structure
const observer = new MutationObserver((mutations) => {
  // Every time Instagram adds new content to the page, scan for spoilers
  scanPage();
});

// Start observing the entire document body for changes
observer.observe(document.body, {
  childList: true,  // Watch for new child elements being added
  subtree: true,    // Watch ALL descendants, not just direct children
});

// ============================================
// MAIN FUNCTION: SCAN PAGE FOR SPOILERS
// ============================================
function scanPage() {
  // If user hasn't added any keywords yet, don't bother scanning
  if (keywords.length === 0) {
    console.log("No keywords to filter");
    return; // Exit function early
  }

  console.log("Scanning page for spoilers...");

  // ============================================
  // FIND INSTAGRAM POSTS
  // ============================================
  // Instagram changes their HTML frequently, so we try multiple selectors
  // These are different ways to find post containers in Instagram's DOM
  const possibleSelectors = [
    'article[role="presentation"]', // Common Instagram post wrapper
    "article",                       // Generic article tags
    'div[role="button"] article',   // Posts inside button divs
    "main article",                  // Articles inside main content area
    '[class*="post"]',              // Any element with "post" in class name
  ];

  // Try each selector until we find posts
  let posts = [];
  for (const selector of possibleSelectors) {
    posts = document.querySelectorAll(selector); // Get all matching elements
    if (posts.length > 0) {
      // Found posts! Log which selector worked
      console.log(`Found ${posts.length} posts using selector: ${selector}`);
      break; // Stop trying other selectors
    }
  }

  // If no posts found with any selector, exit
  if (posts.length === 0) {
    console.log("No posts found on page");
    return;
  }

  // ============================================
  // CHECK EACH POST FOR SPOILERS
  // ============================================
  posts.forEach((post, index) => {
    // Skip posts we've already checked
    // We add a custom attribute to mark processed posts
    if (post.dataset.spoilerChecked) return;
    post.dataset.spoilerChecked = "true"; // Mark as checked

    // Flags to track if this post contains spoilers
    let containsSpoiler = false;
    let spoilerText = ""; // Which keyword triggered the spoiler

    // ============================================
    // METHOD 1: CHECK ALL TEXT CONTENT
    // ============================================
    // Get ALL visible text from the post (caption, comments, etc.)
    const allText = post.innerText.toLowerCase(); // Convert to lowercase for comparison

    // Check if any of our keywords appear in the text
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        containsSpoiler = true;
        spoilerText = keyword; // Remember which keyword we found
        console.log(`Post ${index} contains spoiler keyword: "${keyword}"`);
        break; // Stop checking once we find one spoiler
      }
    }

    // ============================================
    // METHOD 2: CHECK HASHTAGS SPECIFICALLY
    // ============================================
    // Look for hashtag links (e.g., #StrangerThings)
    const hashtags = post.querySelectorAll(
      'a[href*="/explore/tags/"], a[href*="/tags/"]'
    );
    
    // Check each hashtag
    hashtags.forEach((tag) => {
      const tagText = tag.textContent.toLowerCase(); // Get hashtag text
      
      // See if any keyword matches this hashtag
      const found = keywords.find((keyword) => tagText.includes(keyword));
      
      if (found) {
        containsSpoiler = true;
        spoilerText = found;
        console.log(`Post ${index} has hashtag spoiler: "${found}"`);
      }
    });

    // ============================================
    // IF SPOILER FOUND: BLUR THE POST
    // ============================================
    if (containsSpoiler) {
      console.log(`Blurring post ${index} due to keyword: "${spoilerText}"`);
      blurPost(post, spoilerText); // Call function to add blur overlay
      
      // Increment counter and save to storage
      filteredCount++;
      chrome.storage.sync.set({ filteredCount });
    }
  });
}

// ============================================
// BLUR POST FUNCTION: ADD WARNING OVERLAY
// ============================================
function blurPost(post, keyword) {
  // ============================================
  // PREVENT DUPLICATE OVERLAYS
  // ============================================
  // Check if this post already has an overlay
  if (post.querySelector(".spoiler-overlay")) {
    return; // Already blurred, don't add another overlay
  }

  // ============================================
  // CREATE THE OVERLAY ELEMENT
  // ============================================
  // Create a new div that will cover the entire post
  const overlay = document.createElement("div");
  overlay.className = "spoiler-overlay"; // Give it a class for future reference
  
  // Apply CSS styles to make it cover the post with dark background
  overlay.style.cssText = `
    position: absolute;        /* Position relative to parent post */
    top: 0;                    /* Start at top of post */
    left: 0;                   /* Start at left of post */
    width: 100%;               /* Cover full width */
    height: 100%;              /* Cover full height */
    background: rgba(0, 0, 0, 0.95);  /* Almost black background */
    backdrop-filter: blur(20px);      /* Blur what's behind overlay */
    z-index: 999999;           /* Appear on top of everything else */
    display: flex;             /* Use flexbox for centering */
    flex-direction: column;    /* Stack items vertically */
    align-items: center;       /* Center items horizontally */
    justify-content: center;   /* Center items vertically */
    color: white;              /* White text */
    text-align: center;        /* Center-align text */
    padding: 20px;             /* Space around content */
    box-sizing: border-box;    /* Include padding in width/height */
  `;

  // ============================================
  // ADD HTML CONTENT TO OVERLAY
  // ============================================
  // Create the warning message and buttons using HTML
  overlay.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">
      Potential Spoiler Detected
    </div>
    <div style="font-size: 14px; color: #ccc; margin-bottom: 20px;">
      Contains: "${keyword}"
    </div>
    <button class="show-anyway-btn" style="
      background: #0095f6;      /* Instagram blue */
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;       /* Rounded corners */
      cursor: pointer;          /* Show hand cursor on hover */
      font-weight: 600;         /* Bold text */
      font-size: 14px;
      margin: 5px;
    ">Show Anyway</button>
    <button class="hide-post-btn" style="
      background: transparent;   /* See-through background */
      color: white;
      border: 1px solid white;  /* White border */
      padding: 10px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      margin: 5px;
    ">Hide Post</button>
  `;

  // ============================================
  // SETUP: MAKE POST CONTAINER RELATIVE
  // ============================================
  // For absolute positioning to work, parent must be relative
  post.style.position = "relative";
  
  // Add the overlay as a child of the post
  post.appendChild(overlay);

  // ============================================
  // BUTTON 1: "SHOW ANYWAY" CLICK HANDLER
  // ============================================
  // Find the "Show Anyway" button we just created
  overlay.querySelector(".show-anyway-btn").addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent click from bubbling to parent elements
    overlay.remove();    // Remove the overlay from the DOM
    console.log("User chose to show post anyway");
  });

  // ============================================
  // BUTTON 2: "HIDE POST" CLICK HANDLER
  // ============================================
  // Find the "Hide Post" button
  overlay.querySelector(".hide-post-btn").addEventListener("click", (e) => {
    e.stopPropagation();        // Prevent click from bubbling
    post.style.display = "none"; // Hide the entire post
    console.log("User chose to hide post");
  });
}

// ============================================
// INITIALIZATION LOG MESSAGES
// ============================================
// Log that the extension is running (useful for debugging)
console.log("Instagram Spoiler Filter active!");
console.log("Current URL:", window.location.href);