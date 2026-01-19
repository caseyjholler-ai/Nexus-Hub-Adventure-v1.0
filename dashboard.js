import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc, 
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let userData = null;

// Make simple hash from email + uid
function makeHash(email, uid) {
  return (uid.substring(0, 8) + email.substring(0, 4)).toLowerCase();
}

// Create fallback user document if missing
async function createFallbackUserDocument(user) {
  try {
    console.log('[FALLBACK] Creating missing user document for:', user.email);
    
    const userRef = doc(db, 'users', user.uid);
    const hash = makeHash(user.email, user.uid);
    
    await setDoc(userRef, {
      email: user.email,
      uid: user.uid,
      portalHash: hash,
      careBalance: 0,
      eggStatus: 'none',
      eggSessionsRemaining: 10,
      dragonId: null,
      dragonName: null,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    
    console.log('[FALLBACK] User document created successfully');
    return true;
    
  } catch (error) {
    console.error('[FALLBACK ERROR]', error);
    throw error;
  }
}

// Load user data from Firestore
async function loadUserData(uid) {
  try {
    console.log('[LOAD] Fetching user document for UID:', uid);
    
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      // Document exists - normal flow
      const data = userSnap.data();
      userData = data;
      
      document.getElementById('userEmail').textContent = data.email;
      document.getElementById('careBalance').textContent = (data.careBalance || 0).toLocaleString();
      
      // Update dragon status
      if (data.eggStatus === 'hatched') {
        document.getElementById('dragonStatus').textContent = `Dragon: ${data.dragonName || 'Unnamed Dragon'}`;
      } else if (data.eggStatus === 'incubating') {
        document.getElementById('dragonStatus').textContent = `Egg Incubating (${data.eggSessionsRemaining || 10} sessions)`;
      } else {
        document.getElementById('dragonStatus').textContent = 'No Dragon Yet';
      }
      
      console.log('[LOAD] User data loaded successfully');
      
    } else {
      // Document missing - create fallback
      console.warn('[LOAD] User document not found! Creating fallback...');
      
      // Show loading state
      document.getElementById('userEmail').textContent = 'Setting up profile...';
      
      // Create the missing document
      await createFallbackUserDocument(currentUser);
      
      // Reload user data
      await loadUserData(uid);
    }
    
  } catch (error) {
    console.error('[LOAD ERROR]', error);
    
    // Show error to user
    document.getElementById('userEmail').textContent = 'Error loading profile';
    
    // Show error banner
    const errorBanner = document.createElement('div');
    errorBanner.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    errorBanner.innerHTML = `
      <p class="font-bold">Profile Error</p>
      <p class="text-sm">Unable to load your profile. Please refresh the page.</p>
      <button onclick="location.reload()" class="mt-2 bg-white text-red-600 px-4 py-1 rounded text-sm font-semibold">
        Refresh Page
      </button>
    `;
    document.body.appendChild(errorBanner);
  }
}

// Load campaigns
async function loadCampaigns() {
  try {
    const campaignsRef = collection(db, 'campaigns');
    const q = query(campaignsRef, where('userId', '==', currentUser.uid));
    const querySnapshot = await getDocs(q);
    
    const campaignsGrid = document.getElementById('campaignsGrid');
    const noCampaigns = document.getElementById('noCampaigns');
    
    document.getElementById('campaignsLoading').classList.add('hidden');
    
    document.getElementById('campaignCount').textContent = querySnapshot.size;
    
    if (querySnapshot.empty) {
      noCampaigns.classList.remove('hidden');
      return;
    }
    
    campaignsGrid.classList.remove('hidden');
    campaignsGrid.innerHTML = '';
    
    querySnapshot.forEach((doc) => {
      const campaign = doc.data();
      const card = createCampaignCard(doc.id, campaign);
      campaignsGrid.appendChild(card);
    });
    
  } catch (error) {
    console.error('[CAMPAIGNS ERROR]', error);
    document.getElementById('campaignsLoading').innerHTML = `
      <p class="text-red-400">Error loading campaigns. Please refresh the page.</p>
    `;
  }
}

// Create campaign card
function createCampaignCard(id, campaign) {
  const card = document.createElement('a');
  card.href = 'campaign.html?id=' + id;
  card.className = 'card-document';
  
  const iconMap = {
    'Fantasy': '⚔️',
    'Sci-Fi': '🚀',
    'Cyberpunk': '⚡',
    'Horror': '👻',
    'Cozy': '🍃',
    'Custom': '🎲'
  };
  
  const icon = iconMap[campaign.system] || '🎲';
  
  card.innerHTML = `
    <div class="flex justify-between items-start mb-4">
      <div>
        <div class="text-4xl mb-2">${icon}</div>
        <h3 class="text-xl font-bold">${campaign.name}</h3>
        <p class="text-sm text-gray-600">${campaign.system}</p>
      </div>
      <div class="text-right">
        <p class="text-sm text-gray-600">CARE Earned</p>
        <p class="text-2xl font-bold text-emerald-600">${campaign.careEarned || 0}</p>
      </div>
    </div>
    ${campaign.description ? `<p class="text-sm text-gray-700 mb-3">${campaign.description}</p>` : ''}
    <div class="flex justify-between text-xs text-gray-500">
      <span>View Campaign</span>
      <span>→</span>
    </div>
  `;
  
  return card;
}

// Check if logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('[AUTH] User authenticated:', user.email);
    currentUser = user;
    loadUserData(user.uid);
    loadCampaigns();
  } else {
    console.log('[AUTH] No user authenticated, redirecting to login');
    window.location.href = 'auth.html';
  }
});

// Logout button - with safety check
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      console.log('[LOGOUT] Signing out...');
      await signOut(auth);
      window.location.href = 'auth.html';
    } catch (error) {
      console.error('[LOGOUT ERROR]', error);
      alert('Error logging out. Please try again.');
    }
  });
} else {
  console.error('[ERROR] Logout button not found in DOM');
}

// Create Campaign Modal
const createBtn = document.getElementById('createCampaignBtn');
const createModal = document.getElementById('createCampaignModal');
const createForm = document.getElementById('createCampaignForm');

createBtn.addEventListener('click', () => {
  createModal.classList.remove('hidden');
});

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const name = document.getElementById('campaignNameInput').value.trim();
    const system = document.getElementById('campaignSystemInput').value;
    const description = document.getElementById('campaignDescriptionInput').value.trim();
    
    if (!name || !system) {
      alert('Please fill in all required fields');
      return;
    }
    
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    
    const campaignRef = await addDoc(collection(db, 'campaigns'), {
      userId: currentUser.uid,
      name: name,
      system: system,
      description: description,
      careEarned: 0,
      createdAt: serverTimestamp(),
      lastSession: null
    });
    
    console.log('[CAMPAIGN] Created:', campaignRef.id);
    
    // Close modal and refresh
    createModal.classList.add('hidden');
    createForm.reset();
    createBtn.disabled = false;
    createBtn.textContent = '+ Create Campaign';
    
    loadCampaigns();
    
  } catch (error) {
    console.error('[CAMPAIGN ERROR]', error);
    alert('Error creating campaign. Please try again.');
    createBtn.disabled = false;
    createBtn.textContent = '+ Create Campaign';
  }
});

// Close modal when clicking outside
createModal.addEventListener('click', (e) => {
  if (e.target === createModal) {
    createModal.classList.add('hidden');
  }
});
