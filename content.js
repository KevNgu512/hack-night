// Content script that runs on Instagram pages
let keywords = [];
let checkComments = false;
let filteredCount = 0;

// Load settings
chrome.storage.sync.get(['keywords', 'checkComments', 'filteredCount'], (data) => {
  keywords = data.keywords || [];
  checkComments = data.checkComments || false;
  filteredCount = data.filteredCount || 0;
  console.log('Spoiler filter loaded with keywords:', keywords);
  console.log('Check comments enabled:', checkComments);
  
  // Initial scan after a short delay to let Instagram load
  setTimeout(scanPage, 2000);
});

// Listen for updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateKeywords') {
    keywords = message.keywords;
    console.log('Keywords updated:', keywords);
    scanPage();
  } else if (message.action === 'updateSettings') {
    chrome.storage.sync.get(['checkComments'], (data) => {
      checkComments = data.checkComments || false;
      console.log('Settings updated, checkComments:', checkComments);
      scanPage();
    });
  }
});

// Watch for new posts loaded (infinite scroll)
const observer = new MutationObserver((mutations) => {
  scanPage();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function scanPage() {
  if (keywords.length === 0) {
    console.log('No keywords to filter');
    return;
  }

  console.log('Scanning page for spoilers...');

  // Try multiple selectors for Instagram posts (they change frequently)
  const possibleSelectors = [
    'article[role="presentation"]',
    'article',
    'div[role="button"] article',
    'main article',
    '[class*="post"]'
  ];

  let posts = [];
  for (const selector of possibleSelectors) {
    posts = document.querySelectorAll(selector);
    if (posts.length > 0) {
      console.log(`Found ${posts.length} posts using selector: ${selector}`);
      break;
    }
  }

  if (posts.length === 0) {
    console.log('No posts found on page');
    return;
  }
  
  posts.forEach((post, index) => {
    // Skip if already processed
    if (post.dataset.spoilerChecked) return;
    post.dataset.spoilerChecked = 'true';

    let containsSpoiler = false;
    let spoilerText = '';

    // Get all text content from the post
    const allText = post.innerText.toLowerCase();
    
    // Check for keywords in all text
    for (const keyword of keywords) {
      if (allText.includes(keyword)) {
        containsSpoiler = true;
        spoilerText = keyword;
        console.log(`Post ${index} contains spoiler keyword: "${keyword}"`);
        break;
      }
    }

    // Also specifically check hashtags
    const hashtags = post.querySelectorAll('a[href*="/explore/tags/"], a[href*="/tags/"]');
    hashtags.forEach(tag => {
      const tagText = tag.textContent.toLowerCase();
      const found = keywords.find(keyword => tagText.includes(keyword));
      if (found) {
        containsSpoiler = true;
        spoilerText = found;
        console.log(`Post ${index} has hashtag spoiler: "${found}"`);
      }
    });

    if (containsSpoiler) {
      console.log(`Blurring post ${index} due to keyword: "${spoilerText}"`);
      blurPost(post, spoilerText);
      filteredCount++;
      chrome.storage.sync.set({ filteredCount });
    }
  });
}

function blurPost(post, keyword) {
  // Check if already blurred
  if (post.querySelector('.spoiler-overlay')) {
    return;
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'spoiler-overlay';
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
    ">Hide Post</button>
  `;

  // Make post container relative for overlay positioning
  post.style.position = 'relative';
  post.appendChild(overlay);

  // Show anyway button
  overlay.querySelector('.show-anyway-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    overlay.remove();
    console.log('User chose to show post anyway');
  });

  // Hide post button
  overlay.querySelector('.hide-post-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    post.style.display = 'none';
    console.log('User chose to hide post');
  });
}

console.log('Instagram Spoiler Filter active!');
console.log('Current URL:', window.location.href);