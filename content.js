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
  scanPage();
});

// Listen for updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateKeywords') {
    keywords = message.keywords;
    scanPage();
  } else if (message.action === 'updateSettings') {
    chrome.storage.sync.get(['checkComments'], (data) => {
      checkComments = data.checkComments || false;
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
  if (keywords.length === 0) return;

  // Instagram's post article elements
  const posts = document.querySelectorAll('article[role="presentation"]');
  
  posts.forEach(post => {
    // Skip if already processed
    if (post.dataset.spoilerChecked) return;
    post.dataset.spoilerChecked = 'true';

    let containsSpoiler = false;
    let spoilerText = '';

    // Check caption/description
    const captionElements = post.querySelectorAll('h1, span, div[class*="caption"]');
    captionElements.forEach(el => {
      const text = el.textContent.toLowerCase();
      const found = keywords.find(keyword => text.includes(keyword));
      if (found) {
        containsSpoiler = true;
        spoilerText = found;
      }
    });

    // Check hashtags
    const hashtags = post.querySelectorAll('a[href*="/explore/tags/"]');
    hashtags.forEach(tag => {
      const tagText = tag.textContent.toLowerCase();
      const found = keywords.find(keyword => tagText.includes(keyword));
      if (found) {
        containsSpoiler = true;
        spoilerText = found;
      }
    });

    // Check comments if enabled
    if (checkComments) {
      const comments = post.querySelectorAll('ul li span, div[role="button"] + span');
      comments.forEach(comment => {
        const commentText = comment.textContent.toLowerCase();
        const found = keywords.find(keyword => commentText.includes(keyword));
        if (found) {
          containsSpoiler = true;
          spoilerText = found;
        }
      });
    }

    if (containsSpoiler) {
      blurPost(post, spoilerText);
      filteredCount++;
      chrome.storage.sync.set({ filteredCount });
    }
  });
}

function blurPost(post, keyword) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(20px);
    z-index: 999;
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
    <button style="
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
    <button style="
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
  overlay.querySelector('button:first-of-type').addEventListener('click', () => {
    overlay.remove();
  });

  // Hide post button
  overlay.querySelector('button:last-of-type').addEventListener('click', () => {
    post.style.display = 'none';
  });
}

console.log('Instagram Spoiler Filter active!');