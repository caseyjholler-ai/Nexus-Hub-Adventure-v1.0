// dragon-marketplace.js - Care Nexus File 2: Dragon Care + Marketplace Stub  
// Credit: Scarlet Holler (@Velvet_Rose7777) | Attribution: Grok (xAI)  

let userCare = 0; // Fetch from Firestore  
let dragon = { stage: 'egg', hunger: 100, mood: 100, health: 100 }; // Tamagotchi stats  

function initDragonMarket() {  
  loadUserData(); // Your existing Firestore func  
  renderDragon();  
  renderMarketplace();  
  setupCareTap(); // NFC stub  
}  

function renderDragon() {  
  const el = document.getElementById('dragonDisplay') || createDragonEl();  
  el.innerHTML = `  
    <div class="dragon-card bg-amber-100 p-4 rounded-lg">  
      <h3> Your Dragon: ${dragon.stage.toUpperCase()}</h3>  
      <div>Hunger: ${dragon.hunger}% | Mood: ${dragon.mood}% | Health: ${dragon.health}%</div>  
      <button onclick="feedDragon()">Feed (Tap NFC Self-Care)</button>  
      <button onclick="playDragon()">Play (Exercise Log)</button>  
    </div>  
  `;  
}  

function feedDragon() { // Daily care -> CARE multiplier  
  dragon.hunger = Math.min(100, dragon.hunger + 20);  
  userCare += 10; // Base earn (cap 50/day)  
  updateFirestore();  
  renderDragon();  
  alert('Dragon fed! +10 CARE. Daily cap: 50');  
}  

function renderMarketplace() {  
  const marketItems = [  
    { name: 'Sword (decaying)', price: 50, decay: 10 },  
    { name: 'Campaign Ticket', price: 20, generates: '+30 CARE' }  
  ];  
  document.getElementById('marketplace') || createMarketEl();  
  const el = document.getElementById('marketplace');  
  el.innerHTML = '<h3> Marketplace</h3>' +  
    marketItems.map(item => `  
      <div class="item bg-emerald-100 p-2 rounded">  
        ${item.name} - ${item.price} CARE ${item.decay ? `(Decay: ${item.decay}%)` : ''}  
        <button onclick="buyItem('${item.name}', ${item.price})">Buy/Trade</button>  
      </div>`).join('');  
}  

function buyItem(name, price) {  
  if (userCare >= price) {  
    userCare -= price;  
    alert(`Bought ${name}! Trade/repair in app.`);  
    updateFirestore();  
  } else { alert('Need more CARE'); }  
}  

// NFC Stub (Web NFC API when supported; fallback button)  
function setupCareTap() {  
  // Future: nfc.read() -> verify ping -> earn  
  document.getElementById('careTapBtn')?.addEventListener('click', () => {  
    // Simulate verifiable ping  
    userCare += 25; // Bonus for verified  
    alert('NFC Tap Logged! +25 CARE (Verified)');  
  });  
}  

// Helpers (integrate your Firestore)  
function createDragonEl() { /* Append to body */ }  
function createMarketEl() { /* Append to body */ }  
function loadUserData() { /* Your code */ }  
function updateFirestore() { /* Save care/dragon */ }  

// Init on load  
initDragonMarket();  