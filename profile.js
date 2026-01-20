// profile.js - FIXED VERSION
// Properly queries Firestore to find user by portalHash
// Attribution: Fixed by Claude (Anthropic) for Casey Holler

import { db } from './firebase-config.js';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  limit 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Get portal hash from URL
function getHashFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// Load user by portal hash
async function loadProfile() {
  const hash = getHashFromURL();
  
  if (!hash) {
    document.getElementById('profileData').innerHTML = '<p class="text-red-600 text-center">No profile ID provided</p>';
    return;
  }
  
  console.log('[PROFILE] Looking up hash:', hash);
  
  try {
    // Query Firestore: Find user where portalHash matches
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('portalHash', '==', hash), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('[PROFILE] No user found with this hash');
      document.getElementById('profileData').innerHTML = '<p class="text-red-600 text-center">Profile not found</p>';
      return;
    }
    
    // Get the first (and only) result
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('[PROFILE] Found user:', userData.email);
    
    // Display profile data
    document.getElementById('profileEmail').textContent = userData.email;
    document.getElementById('profileHash').textContent = userData.portalHash;
    document.getElementById('profileCare').textContent = (userData.careBalance || 0).toLocaleString();
    
    // Dragon status
    if (userData.eggStatus === 'hatched' && userData.dragonName) {
      document.getElementById('profileDragon').textContent = `🐉 ${userData.dragonName}`;
      document.getElementById('dragonSubtext').textContent = `Level ${userData.dragonLevel || 1} Companion`;
    } else if (userData.eggStatus === 'incubating') {
      const remaining = userData.eggSessionsRemaining || 10;
      document.getElementById('profileDragon').textContent = `🥚 Egg`;
      document.getElementById('dragonSubtext').textContent = `${remaining} sessions to hatch`;
    } else {
      document.getElementById('profileDragon').textContent = '🥚 None';
      document.getElementById('dragonSubtext').textContent = 'No dragon yet';
    }
    
    // Additional stats
    document.getElementById('totalSessions').textContent = userData.lifetimeSessions || 0;
    document.getElementById('lifetimeActions').textContent = userData.lifetimeActions || 0;
    
    // Member since
    if (userData.createdAt) {
      const date = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt.seconds * 1000);
      document.getElementById('memberSince').textContent = date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      });
    }
    
    // Load campaigns count
    await loadCampaignCount(userDoc.id);
    
    // Generate achievements
    generateAchievements(userData);
    
    // Show profile
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('profileData').classList.remove('hidden');
    
  } catch (error) {
    console.error('[PROFILE ERROR]', error);
    document.getElementById('profileData').innerHTML = `
      <p class="text-red-600 text-center">Error loading profile</p>
      <p class="text-sm text-gray-600 text-center mt-2">${error.message}</p>
    `;
  }
}

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = 'dashboard.html';
});

// Load on page open
loadProfile();

// Helper: Load campaign count for user
async function loadCampaignCount(userId) {
  try {
    const campaignsRef = collection(db, 'campaigns');
    const q = query(campaignsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    document.getElementById('profileCampaigns').textContent = querySnapshot.size;
  } catch (error) {
    console.error('[PROFILE] Error loading campaigns:', error);
    document.getElementById('profileCampaigns').textContent = '0';
  }
}

// Helper: Generate achievement badges
function generateAchievements(userData) {
  const achievements = [];
  
  // CARE milestones
  const care = userData.careBalance || 0;
  if (care >= 100) achievements.push({ icon: '💰', name: 'First Century', desc: '100+ CARE earned' });
  if (care >= 500) achievements.push({ icon: '💎', name: 'CARE Collector', desc: '500+ CARE earned' });
  if (care >= 1000) achievements.push({ icon: '👑', name: 'CARE Monarch', desc: '1,000+ CARE earned' });
  
  // Dragon achievements
  if (userData.eggStatus === 'hatched') {
    achievements.push({ icon: '🐉', name: 'Dragon Parent', desc: 'Hatched a dragon' });
  }
  if (userData.dragonLevel >= 5) {
    achievements.push({ icon: '⭐', name: 'Dragon Trainer', desc: 'Level 5+ dragon' });
  }
  
  // Session achievements
  const sessions = userData.lifetimeSessions || 0;
  if (sessions >= 5) achievements.push({ icon: '📖', name: 'Adventurer', desc: '5+ sessions logged' });
  if (sessions >= 25) achievements.push({ icon: '🗡️', name: 'Veteran', desc: '25+ sessions logged' });
  if (sessions >= 100) achievements.push({ icon: '🏆', name: 'Legend', desc: '100+ sessions logged' });
  
  // Early adopter
  if (userData.createdAt) {
    const created = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt.seconds * 1000);
    if (created < new Date('2025-02-01')) {
      achievements.push({ icon: '🌟', name: 'Early Adopter', desc: 'Joined in beta' });
    }
  }
  
  const container = document.getElementById('achievementsList');
  
  if (achievements.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-sm">No achievements yet - keep playing!</p>';
    return;
  }
  
  container.innerHTML = achievements.map(a => `
    <div class="inline-flex items-center gap-2 bg-amber-100 border-2 border-amber-500 rounded-lg px-4 py-2">
      <span class="text-2xl">${a.icon}</span>
      <div>
        <p class="font-bold text-sm">${a.name}</p>
        <p class="text-xs text-gray-600">${a.desc}</p>
      </div>
    </div>
  `).join('');
}

