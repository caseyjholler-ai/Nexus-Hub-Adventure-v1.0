import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
  
  try {
    // Query: Find user with this portal hash
    // For simplicity, we'll search through users collection
    const usersCollection = await fetch('/api/getUserByHash?hash=' + hash)
      .then(r => r.json())
      .catch(() => null);
    
    if (usersCollection) {
      document.getElementById('profileEmail').textContent = usersCollection.email;
      document.getElementById('profileHash').textContent = usersCollection.portalHash;
      document.getElementById('profileCare').textContent = usersCollection.careBalance || 0;
      document.getElementById('profileDragon').textContent = 
        usersCollection.dragonId ? `🐉 ${usersCollection.dragonName}` : '🥚 Egg';
    }
    
  } catch (error) {
    console.error('Error loading profile:', error);
    document.getElementById('profileData').innerHTML = '<p class="text-red-600 text-center">Profile not found</p>';
  }
}

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = 'dashboard.html';
});

// Load on page open
loadProfile();