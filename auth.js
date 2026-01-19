import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
  doc, 
  setDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Redirect if already logged in
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'dashboard.html';
  }
});

// Show error/success messages
function showMessage(text, type = 'error') {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.classList.remove('hidden', 'bg-red-100', 'text-red-800', 'bg-green-100', 'text-green-800');
  
  if (type === 'error') {
    messageEl.classList.add('bg-red-100', 'text-red-800');
  } else {
    messageEl.classList.add('bg-green-100', 'text-green-800');
  }
  
  setTimeout(() => {
    messageEl.classList.add('hidden');
  }, 5000);
}

// Make simple hash from email + uid
function makeHash(email, uid) {
  // Just use first 8 chars of uid + first 4 of email
  return (uid.substring(0, 8) + email.substring(0, 4)).toLowerCase();
}

// Create user in Firestore with retry logic
async function createUserInFirestore(user, hash, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Attempt ${attempt}/${retries}] Creating Firestore document for ${user.email}`);
      
      const userRef = doc(db, 'users', user.uid);
      
      // Use setDoc with merge option as safety net
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
      }, { merge: true }); // merge: true prevents overwriting if doc already exists
      
      console.log(`[SUCCESS] User document created: ${hash}`);
      return true;
      
    } catch (error) {
      console.error(`[FAIL] Attempt ${attempt}/${retries} failed:`, error.code, error.message);
      
      // If this was the last attempt, throw the error
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = attempt * 1000; // 1s, 2s, 3s
      console.log(`[RETRY] Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// SIGNUP FORM
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
  
  if (password !== passwordConfirm) {
    showMessage('Passwords do not match', 'error');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  try {
    // Disable button during signup
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    
    console.log('[SIGNUP] Starting account creation for:', email);
    
    // Step 1: Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('[SIGNUP] Firebase Auth user created:', user.uid);
    
    // Step 2: Create Firestore document (with retries)
    submitBtn.textContent = 'Setting up profile...';
    const hash = makeHash(email, user.uid);
    
    await createUserInFirestore(user, hash);
    console.log('[SIGNUP] Firestore document created successfully');
    
    // Step 3: Success - redirect
    showMessage('Account created! Redirecting...', 'success');
    submitBtn.textContent = 'Success! Redirecting...';
    
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 2000);
    
  } catch (error) {
    console.error('[SIGNUP ERROR]', error);
    
    // Re-enable button
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    
    // Handle specific error cases
    if (error.code === 'auth/email-already-in-use') {
      showMessage('Email already registered', 'error');
    } else if (error.code === 'auth/weak-password') {
      showMessage('Password too short (minimum 6 characters)', 'error');
    } else if (error.code === 'auth/invalid-email') {
      showMessage('Invalid email address', 'error');
    } else if (error.code === 'permission-denied') {
      showMessage('Database permission error. Please contact support.', 'error');
    } else {
      showMessage('Signup failed: ' + error.message, 'error');
    }
  }
});

// LOGIN FORM
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  
  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    
    console.log('[LOGIN] Attempting login for:', email);
    await signInWithEmailAndPassword(auth, email, password);
    
    showMessage('Login successful!', 'success');
    submitBtn.textContent = 'Success! Redirecting...';
    
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 1500);
    
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    
    if (error.code === 'auth/invalid-credential' || 
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/user-not-found') {
      showMessage('Invalid email or password', 'error');
    } else if (error.code === 'auth/too-many-requests') {
      showMessage('Too many failed attempts. Please try again later.', 'error');
    } else {
      showMessage('Login failed: ' + error.message, 'error');
    }
  }
});
