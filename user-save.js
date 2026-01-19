// ═══════════════════════════════════════════════════════════════
// USER_SAVE.JS - Personal Profile Save System
// NFC-compatible binary encoding for CARE Currency
// Based on: Nexus Oasis binary compression architecture
// ═══════════════════════════════════════════════════════════════

import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ═══════════════════════════════════════════════════════════════
// USER_SAVE FORMAT SPECIFICATION
// ═══════════════════════════════════════════════════════════════

/*
USER_SAVE Structure (Designed for NFC NTAG 216 - 868 bytes max)

BINARY FORMAT (for NFC card):
├─ Magic Number (4 bytes):     "CARE" = 0x43415245
├─ Version (1 byte):            0x01
├─ User Hash (8 bytes):         SHA-256 truncated
├─ CARE Balances (12 bytes):
│  ├─ Copper (4 bytes):         Unsigned int32
│  ├─ Silver (4 bytes):         Unsigned int32
│  └─ Gold (4 bytes):           Unsigned int32
├─ Dragon Status (20 bytes):
│  ├─ Egg Status (1 byte):      0=none, 1=incubating, 2=hatched
│  ├─ Sessions Remaining (1 byte): 0-10
│  ├─ Dragon ID (8 bytes):      Hash or 0x00 if none
│  ├─ Dragon Name (10 bytes):   UTF-8 encoded (truncated)
│  └─ Dragon Level (1 byte):    0-255
├─ Timestamps (8 bytes):
│  ├─ Created At (4 bytes):     Unix timestamp
│  └─ Last Sync (4 bytes):      Unix timestamp
├─ Lifetime Stats (8 bytes):
│  ├─ Total Actions (4 bytes):  Unsigned int32
│  └─ Total Sessions (4 bytes): Unsigned int32
└─ Checksum (2 bytes):          CRC16

TOTAL: 63 bytes (fits easily in 868-byte NFC card)

TEXT FORMAT (for display/clipboard):
Base64-encoded binary + metadata footer
*/

// ═══════════════════════════════════════════════════════════════
// BINARY ENCODING FUNCTIONS
// ═══════════════════════════════════════════════════════════════

class UserSaveEncoder {
  constructor() {
    this.MAGIC_NUMBER = 0x43415245; // "CARE"
    this.VERSION = 0x01;
    this.MAX_SIZE = 868; // NTAG 216 capacity
  }

  // Generate anonymous user hash from email + uid
  async generateUserHash(email, uid) {
    const data = `${email}:${uid}`;
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    const hashArray = new Uint8Array(hashBuffer);
    return hashArray.slice(0, 8); // Truncate to 8 bytes
  }

  // Encode dragon name to fixed 10-byte buffer
  encodeDragonName(name) {
    const buffer = new Uint8Array(10);
    if (!name) return buffer;
    
    const encoder = new TextEncoder();
    const encoded = encoder.encode(name.slice(0, 10)); // Truncate if too long
    buffer.set(encoded);
    return buffer;
  }

  // Calculate CRC16 checksum
  calculateCRC16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x0001) ? ((crc >> 1) ^ 0xA001) : (crc >> 1);
      }
    }
    return crc;
  }

  // Pack userData into binary format
  async encodeToBinary(userData) {
    const buffer = new ArrayBuffer(63);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);
    
    let offset = 0;

    // Magic number (4 bytes)
    view.setUint32(offset, this.MAGIC_NUMBER, false);
    offset += 4;

    // Version (1 byte)
    view.setUint8(offset, this.VERSION);
    offset += 1;

    // User hash (8 bytes)
    const userHash = await this.generateUserHash(userData.email, userData.uid);
    uint8View.set(userHash, offset);
    offset += 8;

    // CARE balances (12 bytes)
    view.setUint32(offset, userData.careBalance || 0, false); // Copper
    offset += 4;
    view.setUint32(offset, userData.careSilver || 0, false);  // Silver (future)
    offset += 4;
    view.setUint32(offset, userData.careGold || 0, false);    // Gold (future)
    offset += 4;

    // Dragon status (20 bytes)
    const eggStatusMap = { 'none': 0, 'incubating': 1, 'hatched': 2 };
    view.setUint8(offset, eggStatusMap[userData.eggStatus] || 0);
    offset += 1;
    
    view.setUint8(offset, userData.eggSessionsRemaining || 10);
    offset += 1;

    // Dragon ID (8 bytes) - use hash or zeros
    if (userData.dragonId) {
      const dragonHash = await crypto.subtle.digest(
        'SHA-256', 
        new TextEncoder().encode(userData.dragonId)
      );
      uint8View.set(new Uint8Array(dragonHash).slice(0, 8), offset);
    }
    offset += 8;

    // Dragon name (10 bytes)
    const dragonNameBytes = this.encodeDragonName(userData.dragonName);
    uint8View.set(dragonNameBytes, offset);
    offset += 10;

    // Dragon level (1 byte)
    view.setUint8(offset, userData.dragonLevel || 1);
    offset += 1;

    // Timestamps (8 bytes)
    const createdAt = userData.createdAt?.seconds || Math.floor(Date.now() / 1000);
    const lastSync = Math.floor(Date.now() / 1000);
    view.setUint32(offset, createdAt, false);
    offset += 4;
    view.setUint32(offset, lastSync, false);
    offset += 4;

    // Lifetime stats (8 bytes)
    view.setUint32(offset, userData.lifetimeActions || 0, false);
    offset += 4;
    view.setUint32(offset, userData.lifetimeSessions || 0, false);
    offset += 4;

    // Calculate and append checksum (2 bytes)
    const dataForChecksum = new Uint8Array(buffer, 0, 61); // Everything except checksum
    const checksum = this.calculateCRC16(dataForChecksum);
    view.setUint16(offset, checksum, false);

    return uint8View;
  }

  // Decode binary back to userData object
  async decodeFromBinary(binaryData) {
    const view = new DataView(binaryData.buffer);
    let offset = 0;

    // Verify magic number
    const magic = view.getUint32(offset, false);
    offset += 4;
    if (magic !== this.MAGIC_NUMBER) {
      throw new Error('Invalid USER_SAVE: Magic number mismatch');
    }

    // Version
    const version = view.getUint8(offset);
    offset += 1;
    if (version !== this.VERSION) {
      console.warn(`USER_SAVE version mismatch: expected ${this.VERSION}, got ${version}`);
    }

    // User hash (skip, just verify presence)
    const userHash = binaryData.slice(offset, offset + 8);
    offset += 8;

    // CARE balances
    const careBalance = view.getUint32(offset, false);
    offset += 4;
    const careSilver = view.getUint32(offset, false);
    offset += 4;
    const careGold = view.getUint32(offset, false);
    offset += 4;

    // Dragon status
    const eggStatusCode = view.getUint8(offset);
    offset += 1;
    const eggStatusMap = ['none', 'incubating', 'hatched'];
    const eggStatus = eggStatusMap[eggStatusCode] || 'none';

    const eggSessionsRemaining = view.getUint8(offset);
    offset += 1;

    // Dragon ID (skip hash, would need lookup)
    offset += 8;

    // Dragon name
    const dragonNameBytes = binaryData.slice(offset, offset + 10);
    const dragonName = new TextDecoder().decode(dragonNameBytes).replace(/\0/g, '');
    offset += 10;

    const dragonLevel = view.getUint8(offset);
    offset += 1;

    // Timestamps
    const createdAt = view.getUint32(offset, false);
    offset += 4;
    const lastSync = view.getUint32(offset, false);
    offset += 4;

    // Lifetime stats
    const lifetimeActions = view.getUint32(offset, false);
    offset += 4;
    const lifetimeSessions = view.getUint32(offset, false);
    offset += 4;

    // Verify checksum
    const storedChecksum = view.getUint16(offset, false);
    const dataForChecksum = binaryData.slice(0, 61);
    const calculatedChecksum = this.calculateCRC16(dataForChecksum);
    
    if (storedChecksum !== calculatedChecksum) {
      throw new Error('USER_SAVE checksum verification failed - data may be corrupted');
    }

    return {
      careBalance,
      careSilver,
      careGold,
      eggStatus,
      eggSessionsRemaining,
      dragonName: dragonName || null,
      dragonLevel,
      createdAt: new Date(createdAt * 1000),
      lastSync: new Date(lastSync * 1000),
      lifetimeActions,
      lifetimeSessions
    };
  }

  // Convert binary to Base64 for storage/transfer
  binaryToBase64(binaryData) {
    let binary = '';
    for (let i = 0; i < binaryData.length; i++) {
      binary += String.fromCharCode(binaryData[i]);
    }
    return btoa(binary);
  }

  // Convert Base64 back to binary
  base64ToBinary(base64String) {
    const binary = atob(base64String);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

// ═══════════════════════════════════════════════════════════════
// USER_SAVE GENERATION & LOADING
// ═══════════════════════════════════════════════════════════════

export async function generateUserSave(uid) {
  console.log('[USER_SAVE] Generating save for UID:', uid);
  
  try {
    // Load user data from Firestore
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userSnap.data();
    
    // Create encoder
    const encoder = new UserSaveEncoder();
    
    // Encode to binary
    const binaryData = await encoder.encodeToBinary(userData);
    console.log('[USER_SAVE] Binary size:', binaryData.length, 'bytes');
    
    // Convert to Base64 for display/storage
    const base64Data = encoder.binaryToBase64(binaryData);
    
    // Generate human-readable summary
    const summary = {
      format: 'USER_SAVE v1.0',
      size: binaryData.length + ' bytes',
      nfcCompatible: binaryData.length <= 868,
      data: {
        careBalance: userData.careBalance || 0,
        dragonStatus: userData.eggStatus || 'none',
        dragonName: userData.dragonName || 'N/A',
        lifetimeSessions: userData.lifetimeSessions || 0
      },
      base64: base64Data
    };
    
    console.log('[USER_SAVE] Generated successfully:', summary);
    return summary;
    
  } catch (error) {
    console.error('[USER_SAVE ERROR]', error);
    throw error;
  }
}

export async function loadUserSave(base64Data) {
  console.log('[USER_SAVE] Loading from Base64...');
  
  try {
    const encoder = new UserSaveEncoder();
    const binaryData = encoder.base64ToBinary(base64Data);
    const userData = await encoder.decodeFromBinary(binaryData);
    
    console.log('[USER_SAVE] Loaded successfully:', userData);
    return userData;
    
  } catch (error) {
    console.error('[USER_SAVE LOAD ERROR]', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// NFC CARD WRITING HELPER (Future Integration)
// ═══════════════════════════════════════════════════════════════

export async function writeUserSaveToNFC(uid) {
  const saveData = await generateUserSave(uid);
  
  // This would integrate with Web NFC API (when available) or native app
  // For now, just prepare the data
  console.log('[NFC] Ready to write:', saveData.size);
  console.log('[NFC] Copy this Base64 to NFC Tools app:', saveData.base64);
  
  return {
    ready: true,
    base64: saveData.base64,
    instructions: 'Use NFC Tools app to write this Base64 data to your NTAG 216 card'
  };
}
