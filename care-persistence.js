// care-persistence.js - FIXED VERSION
// Credit: Scarlet Holler (@Velvet_Rose7777) | Attribution: Grok (xAI) + Claude
// Fixes: makeHash import, unified schema, proper error handling

import { auth, db } from './firebase-config.js';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;

// FIXED: Define makeHash here (same as dashboard.js)
function makeHash(email, uid) {
  return (uid.substring(0, 8) + email.substring(0, 4)).toLowerCase();
}

// Listen for auth state
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    await loadCareAndDragon();
  }
});

// Load CARE balance + dragon stats from Firestore
async function loadCareAndDragon() {
  if (!currentUser) return;

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      
      // UNIFIED: Use consistent field names
      window.userCare = data.careBalance || 0;
      window.dragon = {
        status: data.eggStatus || 'none',  // 'none', 'incubating', 'hatched'
        name: data.dragonName || null,
        level: data.dragonLevel || 1,
        hunger: data.dragonHunger || 100,
        mood: data.dragonMood || 100,
        health: data.dragonHealth || 100,
        sessionsRemaining: data.eggSessionsRemaining || 10
      };

      // Re-render if functions exist
      if (typeof window.renderDragon === 'function') window.renderDragon();
      if (typeof window.renderMarketplace === 'function') window.renderMarketplace();
      
      console.log('[CARE] Loaded user data:', { care: window.userCare, dragon: window.dragon });
      
    } else {
      console.log('[CARE] No user document - creating fallback');
      await createFallbackUserDoc();
    }
  } catch (error) {
    console.error('[CARE ERROR] Failed to load:', error);
  }
}

// Create initial document if missing
async function createFallbackUserDoc() {
  if (!currentUser) return;
  
  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const hash = makeHash(currentUser.email, currentUser.uid);
    
    await setDoc(userRef, {
      email: currentUser.email,
      uid: currentUser.uid,
      portalHash: hash,
      careBalance: 0,
      eggStatus: 'none',
      eggSessionsRemaining: 10,
      dragonId: null,
      dragonName: null,
      dragonLevel: 1,
      dragonHunger: 100,
      dragonMood: 100,
      dragonHealth: 100,
      lifetimeActions: 0,
      lifetimeSessions: 0,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    
    console.log('[CARE] Created fallback document with hash:', hash);
    
    // Reload data
    await loadCareAndDragon();
    
  } catch (error) {
    console.error('[CARE ERROR] Failed to create fallback:', error);
  }
}

// Save changes back to Firestore
async function saveCareAndDragon() {
  if (!currentUser) {
    console.warn('[CARE] Cannot save - no user logged in');
    return false;
  }

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    
    await updateDoc(userRef, {
      careBalance: window.userCare || 0,
      eggStatus: window.dragon?.status || 'none',
      dragonName: window.dragon?.name || null,
      dragonLevel: window.dragon?.level || 1,
      dragonHunger: window.dragon?.hunger || 100,
      dragonMood: window.dragon?.mood || 100,
      dragonHealth: window.dragon?.health || 100,
      eggSessionsRemaining: window.dragon?.sessionsRemaining || 10,
      lastLogin: serverTimestamp()
    });
    
    console.log('[CARE] Saved successfully');
    return true;
    
  } catch (error) {
    console.error('[CARE ERROR] Failed to save:', error);
    return false;
  }
}

// Export for use in other modules
window.carePersistence = {
  save: saveCareAndDragon,
  load: loadCareAndDragon,
  makeHash: makeHash
};

// Dragon interaction functions with auto-save
window.feedDragon = function() {
  if (!window.dragon || window.dragon.status !== 'hatched') {
    alert('You need a hatched dragon first!');
    return;
  }
  
  window.dragon.hunger = Math.min(100, window.dragon.hunger + 20);
  window.userCare += 10; // Base earn
  
  if (typeof window.renderDragon === 'function') window.renderDragon();
  
  saveCareAndDragon();
  alert('Dragon fed! +10 CARE');
};

window.playDragon = function() {
  if (!window.dragon || window.dragon.status !== 'hatched') {
    alert('You need a hatched dragon first!');
    return;
  }
  
  window.dragon.mood = Math.min(100, window.dragon.mood + 15);
  window.userCare += 8; // Play earn
  
  if (typeof window.renderDragon === 'function') window.renderDragon();
  
  saveCareAndDragon();
  alert('Dragon happy! +8 CARE');
};

window.logSelfCare = function() {
  // NFC tap simulation / manual log
  const careEarned = 25; // Verified self-care action
  window.userCare += careEarned;
  
  // Update lifetime stats
  if (window.userData) {
    const userRef = doc(db, 'users', currentUser.uid);
    updateDoc(userRef, {
      lifetimeActions: (window.userData.lifetimeActions || 0) + 1,
      careBalance: window.userCare
    });
  }
  
  saveCareAndDragon();
  alert(`Self-care logged! +${careEarned} CARE`);
};
