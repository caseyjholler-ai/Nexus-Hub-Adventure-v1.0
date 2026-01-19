import { auth, db } from './firebase-config.js';
import { 
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc, 
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  increment,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let userData = null;

// Check authentication
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'auth.html';
    return;
  }
  
  currentUser = user;
  document.getElementById('userEmail').textContent = user.email;
  
  await loadUserData();
  await loadCampaigns();
  
  document.getElementById('sessionDate').valueAsDate = new Date();
  
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('sessionForm').classList.remove('hidden');
});

// Load user data
async function loadUserData() {
  const userRef = doc(db, 'users', currentUser.uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    userData = userSnap.data();
  }
}

// Load campaigns
async function loadCampaigns() {
  const campaignsRef = collection(db, 'campaigns');
  const q = query(campaignsRef, where('userId', '==', currentUser.uid));
  
  const querySnapshot = await getDocs(q);
  const campaignSelect = document.getElementById('campaignSelect');
  
  if (querySnapshot.empty) {
    campaignSelect.innerHTML = '<option value="">No campaigns yet - create one first!</option>';
    campaignSelect.disabled = true;
    document.getElementById('submitBtn').disabled = true;
    return;
  }
  
  querySnapshot.forEach((doc) => {
    const option = document.createElement('option');
    option.value = doc.id;
    option.textContent = doc.data().name + ' (' + doc.data().system + ')';
    campaignSelect.appendChild(option);
  });
}

// Update CARE total
const careCheckboxes = document.querySelectorAll('input[type="checkbox"]');
careCheckboxes.forEach(checkbox => {
  checkbox.addEventListener('change', updateCareTotal);
});

document.getElementById('sessionRecap').addEventListener('input', updateCareTotal);

function updateCareTotal() {
  let total = 0;
  
  careCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      if (checkbox.id === 'care_recap') {
        const recap = document.getElementById('sessionRecap').value;
        if (recap.length >= 50) {
          total += parseInt(checkbox.value);
        } else {
          checkbox.checked = false;
        }
      } else {
        total += parseInt(checkbox.value);
      }
    }
  });
  
  document.getElementById('careTotal').textContent = total + ' CARE';
}

// Validate recap checkbox
document.getElementById('care_recap').addEventListener('change', function(e) {
  const recap = document.getElementById('sessionRecap').value;
  if (this.checked && recap.length < 50) {
    alert('Please write at least 50 characters in the session recap to earn this bonus.');
    this.checked = false;
    updateCareTotal();
  }
});

// Submit form
document.getElementById('logSessionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging session...';
  
  try {
    const campaignId = document.getElementById('campaignSelect').value;
    const sessionDateInput = document.getElementById('sessionDate').value;
    const sessionRecap = document.getElementById('sessionRecap').value;
    
    let careEarned = 0;
    const selectedActions = [];
    
    careCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        const actionName = checkbox.parentElement.querySelector('label').querySelector('div').textContent;
        selectedActions.push(actionName);
        
        if (checkbox.id === 'care_recap' && sessionRecap.length >= 50) {
          careEarned += parseInt(checkbox.value);
        } else if (checkbox.id !== 'care_recap') {
          careEarned += parseInt(checkbox.value);
        }
      }
    });
    
    if (careEarned === 0) {
      alert('Please select at least one action to earn CARE.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log Session & Earn CARE';
      return;
    }
    
    const sessionDate = Timestamp.fromDate(new Date(sessionDateInput));
    
    await addDoc(collection(db, 'sessions'), {
      userId: currentUser.uid,
      campaignId: campaignId,
      sessionDate: sessionDate,
      recap: sessionRecap,
      careEarned: careEarned,
      actions: selectedActions,
      createdAt: serverTimestamp()
    });
    
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      careBalance: increment(careEarned)
    });
    
    const campaignRef = doc(db, 'campaigns', campaignId);
    await updateDoc(campaignRef, {
      careEarned: increment(careEarned),
      lastSession: serverTimestamp()
    });
    
    let eggHatched = false;
    if (userData.eggStatus === 'incubating') {
      const newSessionsRemaining = (userData.eggSessionsRemaining || 10) - 1;
      
      if (newSessionsRemaining <= 0) {
        await updateDoc(userRef, {
          eggSessionsRemaining: 0,
          eggStatus: 'hatched',
          dragonId: 'dragon_' + Date.now(),
          dragonHatchedAt: serverTimestamp()
        });
        eggHatched = true;
      } else {
        await updateDoc(userRef, {
          eggSessionsRemaining: newSessionsRemaining
        });
      }
    }
    
    document.getElementById('sessionForm').classList.add('hidden');
    document.getElementById('successMessage').classList.remove('hidden');
    document.getElementById('earnedCare').textContent = careEarned;
    
    if (userData.eggStatus === 'incubating' || eggHatched) {
      const eggProgress = document.getElementById('eggProgress');
      const eggMessage = document.getElementById('eggMessage');
      eggProgress.classList.remove('hidden');
      
      if (eggHatched) {
        eggMessage.innerHTML = '<strong>YOUR DRAGON HAS HATCHED!</strong><br>Check your dashboard to name your companion!';
      } else {
        const remaining = (userData.eggSessionsRemaining || 10) - 1;
        eggMessage.textContent = remaining + ' more session' + (remaining === 1 ? '' : 's') + ' until your dragon hatches!';
      }
    }
    
  } catch (error) {
    console.error('Error logging session:', error);
    alert('Error logging session. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log Session & Earn CARE';
  }
});
