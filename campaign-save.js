// ═══════════════════════════════════════════════════════════════
// CAMPAIGN_SAVE.JS - Full Campaign State Save System
// Cross-AI compatible format for campaign resumption
// Based on: Nexus Core SAVE_CODE architecture
// ═══════════════════════════════════════════════════════════════

import { db } from './firebase-config.js';
import { 
  doc, 
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN_SAVE FORMAT SPECIFICATION
// ═══════════════════════════════════════════════════════════════

/*
CAMPAIGN_SAVE Structure (Text format, cross-AI compatible)

SAVE_CODE: [Campaign Name | Date | v1.0]

Campaign Info:
- Name: [name]
- System: [Fantasy/Sci-Fi/etc]
- Description: [description]
- Total CARE Earned: [number]
- Created: [date]
- Last Session: [date]

Sessions: [count]
[Session 1]
  Date: [date]
  CARE Earned: +[number]
  Actions: [list]
  Recap: [full text]
  
[Session 2]
  ...

Dragon Status:
- Status: [none/incubating/hatched]
- Sessions Remaining: [number or N/A]
- Name: [name or N/A]

Context Notes:
- [Any additional campaign-specific notes]

TLDR:
- [3-5 line ultra-short summary]

═══════════════════════════════════════════════════════════════
RESTORATION PROTOCOL:
1. Paste entire SAVE_CODE block into AI
2. Say "Activate Nexus from this code" OR "Resume this campaign"
3. AI loads campaign context and continues from last session

Cross-platform compatible: Claude, GPT, Gemini, Grok, etc.
═══════════════════════════════════════════════════════════════
*/

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN_SAVE GENERATION
// ═══════════════════════════════════════════════════════════════

export async function generateCampaignSave(campaignId) {
  console.log('[CAMPAIGN_SAVE] Generating save for campaign:', campaignId);
  
  try {
    // Load campaign data
    const campaignRef = doc(db, 'campaigns', campaignId);
    const campaignSnap = await getDoc(campaignRef);
    
    if (!campaignSnap.exists()) {
      throw new Error('Campaign not found');
    }
    
    const campaignData = campaignSnap.data();
    
    // Load all sessions for this campaign
    const sessionsRef = collection(db, 'sessions');
    const sessionsQuery = query(
      sessionsRef,
      where('campaignId', '==', campaignId),
      orderBy('sessionDate', 'desc')
    );
    const sessionsSnapshot = await getDocs(sessionsQuery);
    
    const sessions = [];
    sessionsSnapshot.forEach((doc) => {
      sessions.push(doc.data());
    });
    
    // Load user data for dragon status
    const userRef = doc(db, 'users', campaignData.userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};
    
    // Generate SAVE_CODE
    const saveCode = formatCampaignSaveCode(campaignData, sessions, userData);
    
    console.log('[CAMPAIGN_SAVE] Generated successfully');
    return saveCode;
    
  } catch (error) {
    console.error('[CAMPAIGN_SAVE ERROR]', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// FORMATTING FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function formatCampaignSaveCode(campaign, sessions, user) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const createdDate = campaign.createdAt?.toDate 
    ? campaign.createdAt.toDate().toLocaleDateString()
    : 'Unknown';
  
  const lastSessionDate = campaign.lastSession?.toDate
    ? campaign.lastSession.toDate().toLocaleDateString()
    : 'No sessions yet';
  
  // Build sessions section
  let sessionsText = '';
  sessions.forEach((session, index) => {
    const sessionDate = session.sessionDate?.toDate
      ? session.sessionDate.toDate().toLocaleDateString()
      : 'Unknown date';
    
    sessionsText += `\n[Session ${sessions.length - index}]\n`;
    sessionsText += `  Date: ${sessionDate}\n`;
    sessionsText += `  CARE Earned: +${session.careEarned || 0}\n`;
    
    if (session.actions && session.actions.length > 0) {
      sessionsText += `  Actions:\n`;
      session.actions.forEach(action => {
        sessionsText += `    - ${action}\n`;
      });
    }
    
    if (session.recap) {
      sessionsText += `  Recap:\n`;
      // Indent recap text
      const recapLines = session.recap.split('\n');
      recapLines.forEach(line => {
        sessionsText += `    ${line}\n`;
      });
    }
    sessionsText += '\n';
  });
  
  // Build dragon status
  let dragonText = '';
  if (user.eggStatus === 'hatched') {
    dragonText = `- Status: Hatched\n`;
    dragonText += `- Name: ${user.dragonName || 'Unnamed'}\n`;
    dragonText += `- Level: ${user.dragonLevel || 1}\n`;
  } else if (user.eggStatus === 'incubating') {
    dragonText = `- Status: Incubating\n`;
    dragonText += `- Sessions Remaining: ${user.eggSessionsRemaining || 10}\n`;
  } else {
    dragonText = `- Status: None yet\n`;
    dragonText += `- Requirement: 1,000 CARE to purchase Ember Egg\n`;
  }
  
  // Generate TLDR
  const tldr = generateTLDR(campaign, sessions, user);
  
  // Assemble SAVE_CODE
  let saveCode = '';
  saveCode += `SAVE_CODE: ${campaign.name} | ${dateStr} | v1.0\n`;
  saveCode += `${'='.repeat(70)}\n\n`;
  
  saveCode += `Campaign Info:\n`;
  saveCode += `- Name: ${campaign.name}\n`;
  saveCode += `- System: ${campaign.system}\n`;
  if (campaign.description) {
    saveCode += `- Description: ${campaign.description}\n`;
  }
  saveCode += `- Total CARE Earned: ${campaign.careEarned || 0}\n`;
  saveCode += `- Created: ${createdDate}\n`;
  saveCode += `- Last Session: ${lastSessionDate}\n`;
  saveCode += `\n`;
  
  saveCode += `Sessions: ${sessions.length}\n`;
  saveCode += `${'-'.repeat(70)}\n`;
  saveCode += sessionsText;
  
  saveCode += `Dragon Status:\n`;
  saveCode += dragonText;
  saveCode += `\n`;
  
  saveCode += `Context Notes:\n`;
  saveCode += `- Campaign is actively tracked in Nexus Hub\n`;
  saveCode += `- CARE economy integration enabled\n`;
  saveCode += `- All session history preserved above\n`;
  saveCode += `\n`;
  
  saveCode += `TLDR:\n`;
  saveCode += tldr;
  saveCode += `\n`;
  
  saveCode += `${'='.repeat(70)}\n`;
  saveCode += `RESTORATION PROTOCOL:\n`;
  saveCode += `1. Paste entire SAVE_CODE block into AI\n`;
  saveCode += `2. Say "Resume this campaign" or "Activate Nexus from this code"\n`;
  saveCode += `3. AI loads campaign context and continues from last session\n`;
  saveCode += `\n`;
  saveCode += `Cross-platform compatible: Claude, GPT, Gemini, Grok, etc.\n`;
  saveCode += `${'='.repeat(70)}\n`;
  
  return saveCode;
}

function generateTLDR(campaign, sessions, user) {
  const sessionCount = sessions.length;
  const totalCare = campaign.careEarned || 0;
  
  let tldr = `- ${campaign.name} (${campaign.system} campaign)\n`;
  tldr += `- ${sessionCount} session${sessionCount !== 1 ? 's' : ''} logged, ${totalCare} CARE earned\n`;
  
  if (sessions.length > 0) {
    const lastSession = sessions[0];
    const lastDate = lastSession.sessionDate?.toDate
      ? lastSession.sessionDate.toDate().toLocaleDateString()
      : 'recently';
    tldr += `- Last played: ${lastDate}\n`;
  }
  
  if (user.eggStatus === 'hatched') {
    tldr += `- Dragon companion: ${user.dragonName || 'Unnamed'} (Level ${user.dragonLevel || 1})\n`;
  } else if (user.eggStatus === 'incubating') {
    tldr += `- Dragon egg incubating (${user.eggSessionsRemaining || 10} sessions until hatch)\n`;
  }
  
  tldr += `- Ready to continue adventure!\n`;
  
  return tldr;
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN_SAVE COMPRESSION (Optional - for very long campaigns)
// ═══════════════════════════════════════════════════════════════

export async function generateCompressedCampaignSave(campaignId) {
  const fullSave = await generateCampaignSave(campaignId);
  
  // Use pako.js or similar for compression if needed
  // For now, just return full save
  // Future: Implement zlib compression like Nexus Oasis
  
  return {
    compressed: false,
    size: fullSave.length,
    data: fullSave,
    note: 'Compression not implemented yet - full text save only'
  };
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN IMPORT (Future Feature)
// ═══════════════════════════════════════════════════════════════

export function parseCampaignSaveCode(saveCodeText) {
  // Parse SAVE_CODE text back into structured data
  // This would allow importing campaigns from other users
  
  const lines = saveCodeText.split('\n');
  const campaign = {
    name: null,
    system: null,
    description: null,
    sessions: [],
    dragonStatus: null
  };
  
  // Simple parser - extract campaign name from header
  const headerMatch = saveCodeText.match(/SAVE_CODE: (.+) \| (\d{4}-\d{2}-\d{2}) \| v([\d.]+)/);
  if (headerMatch) {
    campaign.name = headerMatch[1];
  }
  
  // Extract system
  const systemMatch = saveCodeText.match(/- System: (.+)/);
  if (systemMatch) {
    campaign.system = systemMatch[1];
  }
  
  // More parsing logic would go here...
  
  return campaign;
}
