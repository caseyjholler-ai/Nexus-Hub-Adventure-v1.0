import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let userData = null;
let campaignId = null;
let campaignData = null;
let sessionsData = [];

// Check auth
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  
  currentUser = user;
  document.getElementById('userEmail').textContent = user.email;
  
  // Get campaign ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  campaignId = urlParams.get('id');
  
  if (!campaignId) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
    return;
  }
  
  await loadUserData();
  await loadCampaign();
});

// Load user data
async function loadUserData() {
  const userRef = doc(db, 'users', currentUser.uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    userData = userSnap.data();
  }
}

// Load campaign data
async function loadCampaign() {
  try {
    const campaignRef = doc(db, 'campaigns', campaignId);
    const campaignSnap = await getDoc(campaignRef);
    
    if (!campaignSnap.exists()) {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('errorState').classList.remove('hidden');
      return;
    }
    
    campaignData = campaignSnap.data();
    
    // Check if user owns this campaign
    if (campaignData.userId !== currentUser.uid) {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('errorState').classList.remove('hidden');
      return;
    }
    
    displayCampaign();
    await loadSessions();
    
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('campaignContent').classList.remove('hidden');
    
  } catch (error) {
    console.error('Error loading campaign:', error);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
  }
}

// Display campaign info
function displayCampaign() {
  document.getElementById('campaignTitle').textContent = campaignData.name;
  document.getElementById('campaignName').textContent = campaignData.name;
  document.getElementById('campaignSystem').textContent = campaignData.system;
  document.getElementById('campaignDescription').textContent = campaignData.description || 'No description provided';
  
  document.getElementById('totalCare').textContent = (campaignData.careEarned || 0).toLocaleString();
  
  // Set icon based on system
  const iconMap = {
    'Fantasy': '⚔️',
    'Sci-Fi': '🚀',
    'Cyberpunk': '⚡',
    'Horror': '👻',
    'Cozy': '🍃',
    'Custom': '🎲'
  };
  document.getElementById('campaignIcon').textContent = iconMap[campaignData.system] || '🎲';
}

// Load sessions
async function loadSessions() {
  const sessionsRef = collection(db, 'sessions');
  const q = query(
    sessionsRef,
    where('campaignId', '==', campaignId),
    orderBy('sessionDate', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  const sessionsList = document.getElementById('sessionsList');
  const noSessions = document.getElementById('noSessions');
  
  if (querySnapshot.empty) {
    noSessions.classList.remove('hidden');
    return;
  }
  
  noSessions.classList.add('hidden');
  document.getElementById('totalSessions').textContent = querySnapshot.size;
  sessionsList.innerHTML = '';
  sessionsData = [];
  
  querySnapshot.forEach((doc) => {
    const session = doc.data();
    sessionsData.push(session);
    const item = createSessionItem(session);
    sessionsList.appendChild(item);
  });
}

// Create session item
function createSessionItem(session) {
  const item = document.createElement('div');
  item.className = 'card-document';
  
  const date = session.sessionDate?.toDate();
  const dateStr = date ? date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) : 'Unknown date';
  
  item.innerHTML = `
    <div class="flex justify-between items-start mb-3">
      <div>
        <div class="font-bold text-lg">${dateStr}</div>
        <div class="text-sm meta">+${session.careEarned} CARE earned</div>
      </div>
    </div>
    ${session.recap ? `
      <div class="mt-3 p-3 bg-slate-50 rounded border-l-4 border-purple-500">
        <p class="text-sm">${session.recap}</p>
      </div>
    ` : ''}
    ${session.actions && session.actions.length > 0 ? `
      <div class="mt-3 flex flex-wrap gap-2">
        ${session.actions.map(action => `
          <span class="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">✓ ${action}</span>
        `).join('')}
      </div>
    ` : ''}
  `;
  
  return item;
}
