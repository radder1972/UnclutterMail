// Central Orchestration Controller - UnclutterMail
import { 
  showScreen, 
  updateScannerUI, 
  updateStatsUI, 
  renderNewsletterList 
} from './ui.js';
import { 
  scanMockEmails 
} from './services/mockService.js';
import { 
  initGoogleClient, 
  requestGmailAccess, 
  disconnectGmail, 
  getSavedClientId, 
  saveClientId, 
  getSavedEmailAddress,
  saveEmailAddress,
  DEFAULT_GMAIL_CLIENT_ID,
  scanRealGmail, 
  unsubscribeRealGmail 
} from './services/gmailService.js';
import {
  initOutlookClient,
  requestOutlookAccess,
  disconnectOutlook,
  getSavedClientId as getSavedOutlookClientId,
  saveClientId as saveOutlookClientId,
  getSavedEmailAddress as getSavedOutlookEmailAddress,
  saveEmailAddress as saveOutlookEmailAddress,
  DEFAULT_OUTLOOK_CLIENT_ID,
  scanRealOutlook,
  cleanNewsletterOutlook
} from './services/outlookService.js';

// Application State
let state = {
  activeMode: 'demo', // 'demo', 'gmail' of 'outlook'
  newsletters: [],
  activeFilter: 'all',
  clientId: '',
  gmailEmailAddress: '',
  outlookClientId: '',
  outlookEmailAddress: ''
};

// Initialisatie als de DOM geladen is
document.addEventListener('DOMContentLoaded', () => {
  setupModeSelection();
  setupCredentialsInput();
  setupScanTriggers();
  setupFilterTabs();
  setupHeaderActions();
  setupAdvancedToggle();
});

// 1. Instellen van de modus-selectie (Demo vs Gmail vs Outlook)
function setupModeSelection() {
  const optDemo = document.getElementById('opt-demo');
  const optGmail = document.getElementById('opt-gmail');
  const optOutlook = document.getElementById('opt-outlook');
  const gmailSetupFields = document.getElementById('gmail-setup-fields');
  const outlookSetupFields = document.getElementById('outlook-setup-fields');
  const badge = document.getElementById('active-mode-badge');

  if (optDemo && optGmail && optOutlook) {
    optDemo.addEventListener('click', () => {
      state.activeMode = 'demo';
      optDemo.classList.add('active');
      optGmail.classList.remove('active');
      optOutlook.classList.remove('active');
      if (gmailSetupFields) gmailSetupFields.style.display = 'none';
      if (outlookSetupFields) outlookSetupFields.style.display = 'none';
      
      // Update badge
      badge.className = 'mode-badge demo';
      badge.querySelector('.badge-text').textContent = 'Demo Modus';
    });

    optGmail.addEventListener('click', () => {
      state.activeMode = 'gmail';
      optGmail.classList.add('active');
      optDemo.classList.remove('active');
      optOutlook.classList.remove('active');
      if (gmailSetupFields) {
        gmailSetupFields.style.display = 'block';
        // Focus het Gmail-adres veld in plaats van Client-ID
        const input = document.getElementById('gmail-email-address');
        if (input) input.focus();
      }
      if (outlookSetupFields) outlookSetupFields.style.display = 'none';
      
      // Update badge
      badge.className = 'mode-badge gmail';
      badge.querySelector('.badge-text').textContent = 'Gmail Modus';
    });

    optOutlook.addEventListener('click', () => {
      state.activeMode = 'outlook';
      optOutlook.classList.add('active');
      optDemo.classList.remove('active');
      optGmail.classList.remove('active');
      if (outlookSetupFields) {
        outlookSetupFields.style.display = 'block';
        // Focus het Microsoft/Outlook-adres veld
        const input = document.getElementById('outlook-email-address');
        if (input) input.focus();
      }
      if (gmailSetupFields) gmailSetupFields.style.display = 'none';
      
      // Update badge
      badge.className = 'mode-badge outlook';
      badge.querySelector('.badge-text').textContent = 'Outlook Modus';
    });
  }
}

// 2. Client ID & Gmail Email voorbereiden en opslaan
function setupCredentialsInput() {
  const gmailInput = document.getElementById('gmail-client-id');
  if (gmailInput) {
    // Laad opgeslagen ID
    const savedId = getSavedClientId();
    gmailInput.value = savedId;
    state.clientId = savedId;

    // Sla op bij typen/focus verlies
    gmailInput.addEventListener('input', (e) => {
      state.clientId = e.target.value.trim();
      saveClientId(state.clientId);
    });
  }

  const gmailEmailInput = document.getElementById('gmail-email-address');
  if (gmailEmailInput) {
    // Laad opgeslagen Gmail-adres
    const savedEmail = getSavedEmailAddress();
    gmailEmailInput.value = savedEmail;
    state.gmailEmailAddress = savedEmail;

    // Sla op bij typen/focus verlies
    gmailEmailInput.addEventListener('input', (e) => {
      state.gmailEmailAddress = e.target.value.trim();
      saveEmailAddress(state.gmailEmailAddress);
    });
  }

  const outlookEmailInput = document.getElementById('outlook-email-address');
  if (outlookEmailInput) {
    // Laad opgeslagen Microsoft/Outlook-adres
    const savedEmail = getSavedOutlookEmailAddress();
    outlookEmailInput.value = savedEmail;
    state.outlookEmailAddress = savedEmail;

    // Sla op bij typen/focus verlies
    outlookEmailInput.addEventListener('input', (e) => {
      state.outlookEmailAddress = e.target.value.trim();
      saveOutlookEmailAddress(state.outlookEmailAddress);
    });
  }

  const outlookInput = document.getElementById('outlook-client-id');
  if (outlookInput) {
    // Laad opgeslagen ID
    const savedId = getSavedOutlookClientId();
    outlookInput.value = savedId;
    state.outlookClientId = savedId;

    // Sla op bij typen/focus verlies
    outlookInput.addEventListener('input', (e) => {
      state.outlookClientId = e.target.value.trim();
      saveOutlookClientId(state.outlookClientId);
    });
  }
}

// Event handler voor de discrete "Geavanceerde Instellingen" toggle
function setupAdvancedToggle() {
  const links = document.querySelectorAll('.advanced-settings-link');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation(); // Voorkom dat ouder auth-opties clicks vangen
      
      const targetId = link.getAttribute('data-target');
      const targetDiv = document.getElementById(targetId);
      const textSpan = link.querySelector('.toggle-text');
      
      if (targetDiv) {
        if (targetDiv.style.display === 'none' || !targetDiv.style.display) {
          targetDiv.style.display = 'block';
          if (textSpan) textSpan.textContent = 'Verberg Geavanceerde Instellingen';
        } else {
          targetDiv.style.display = 'none';
          if (textSpan) textSpan.textContent = 'Geavanceerde Instellingen';
        }
      }
    });
  });
}

// 3. Starten van de scan-processen
function setupScanTriggers() {
  const btnStartScan = document.getElementById('btn-start-scan');
  const btnScanAgain = document.getElementById('btn-scan-again');

  if (btnStartScan) {
    btnStartScan.addEventListener('click', () => {
      startScanning();
    });
  }

  if (btnScanAgain) {
    btnScanAgain.addEventListener('click', () => {
      startScanning();
    });
  }
}

async function startScanning() {
  const gmailInstructions = document.getElementById('gmail-instructions-panel');
  const outlookInstructions = document.getElementById('outlook-instructions-panel');
  const errorCard = document.getElementById('error-diagnostic-card');
  if (errorCard) errorCard.style.display = 'none';
  
  if (state.activeMode === 'demo') {
    if (gmailInstructions) gmailInstructions.style.display = 'none';
    if (outlookInstructions) outlookInstructions.style.display = 'none';
    
    // Switch naar scanner
    showScreen('screen-scanner');
    
    // Start mock scan
    try {
      const results = await scanMockEmails((progress) => {
        updateScannerUI(progress);
      });
      
      // Sla resultaten op
      state.newsletters = results;
      
      // Laad Dashboard
      finishScanning();
    } catch (e) {
      handleScanError(e);
    }
    
  } else if (state.activeMode === 'gmail') {
    // Gmail Modus
    if (gmailInstructions) gmailInstructions.style.display = 'block';
    if (outlookInstructions) outlookInstructions.style.display = 'none';
    
    if (!state.gmailEmailAddress) {
      alert('Vul eerst jouw Gmail-adres in om te koppelen met Gmail.');
      return;
    }

    const clientIdToUse = state.clientId || DEFAULT_GMAIL_CLIENT_ID;

    // Initialiseer en start Google flow
    initGoogleClient(
      clientIdToUse, 
      // Callback bij succesvol token
      async (token) => {
        document.getElementById('btn-disconnect').style.display = 'inline-flex';
        showScreen('screen-scanner');
        
        try {
          const results = await scanRealGmail((progress) => {
            updateScannerUI(progress);
          });
          
          state.newsletters = results;
          finishScanning();
        } catch (err) {
          handleScanError(err);
        }
      },
      // Callback bij fout
      (errMsg) => {
        handleScanError(errMsg);
      }
    );

    // Vraag toegang aan (opent popup met login hint)
    requestGmailAccess(state.gmailEmailAddress);
  } else if (state.activeMode === 'outlook') {
    // Outlook Modus
    if (outlookInstructions) outlookInstructions.style.display = 'block';
    if (gmailInstructions) gmailInstructions.style.display = 'none';
    
    if (!state.outlookEmailAddress) {
      alert('Vul eerst jouw Microsoft- of Outlook-adres in om te koppelen met Outlook.');
      return;
    }

    const outlookClientIdToUse = state.outlookClientId || DEFAULT_OUTLOOK_CLIENT_ID;

    try {
      // 1. Initialiseer en probeer stille aanmelding te herstellen
      const hasSession = await initOutlookClient(
        outlookClientIdToUse,
        (errMsg) => {
          console.warn("MSAL silent init warning/error:", errMsg);
        }
      );

      let tokenReceived = false;

      if (hasSession) {
        // We hebben stilzwijgend al een token gekregen
        tokenReceived = true;
      } else {
        // Geen actieve sessie, start interactieve popup met loginHint
        await requestOutlookAccess(state.outlookEmailAddress);
        tokenReceived = true;
      }

      if (tokenReceived) {
        document.getElementById('btn-disconnect').style.display = 'inline-flex';
        showScreen('screen-scanner');
        
        try {
          const results = await scanRealOutlook((progress) => {
            updateScannerUI(progress);
          });
          
          state.newsletters = results;
          finishScanning();
        } catch (err) {
          handleScanError(err);
        }
      }
    } catch (err) {
      handleScanError(err);
    }
  }
}

function handleScanError(err) {
  showScreen('screen-welcome');
  const errorCard = document.getElementById('error-diagnostic-card');
  const errorText = document.getElementById('error-msg-text');
  const failedFetchTips = document.getElementById('diagnostic-failed-fetch-tips');

  const message = typeof err === 'object' ? (err.message || err.error || JSON.stringify(err)) : err;

  if (errorCard && errorText) {
    errorCard.style.display = 'block';
    errorText.textContent = message;

    const errMsgLower = message.toLowerCase();
    if (errMsgLower.includes('fetch') || errMsgLower.includes('typeerror') || errMsgLower.includes('cors')) {
      if (failedFetchTips) failedFetchTips.style.display = 'block';
    } else {
      if (failedFetchTips) failedFetchTips.style.display = 'none';
    }
    
    errorCard.scrollIntoView({ behavior: 'smooth' });
  } else {
    alert(`Er ging iets fout tijdens het inlezen van je e-mails: ${message}`);
  }
}

function finishScanning() {
  // Update stats
  updateStatsUI(state.newsletters);
  
  // Render lijst
  renderNewsletterList(
    state.newsletters, 
    state.activeFilter, 
    handleUnsubscribe
  );
  
  // Switch naar Dashboard
  showScreen('screen-dashboard');
}

// 4. Afhandelen van het uitschrijven (Unsubscribe callback)
async function handleUnsubscribe(item) {
  if (state.activeMode === 'demo') {
    // Simuleer een netwerkvertraging van 600ms
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Update de status in het geheugen
    const target = state.newsletters.find(n => n.id === item.id);
    if (target) {
      target.status = 'unsubscribed';
    }
  } else if (state.activeMode === 'gmail') {
    // Echte Gmail afhandeling
    await unsubscribeRealGmail(item);
    
    const target = state.newsletters.find(n => n.id === item.id);
    if (target) {
      target.status = 'unsubscribed';
    }
  } else if (state.activeMode === 'outlook') {
    // Echte Outlook afhandeling
    await cleanNewsletterOutlook(item);
    
    const target = state.newsletters.find(n => n.id === item.id);
    if (target) {
      target.status = 'unsubscribed';
    }
  }

  // Update UI & Stats direct live!
  updateStatsUI(state.newsletters);
  renderNewsletterList(
    state.newsletters, 
    state.activeFilter, 
    handleUnsubscribe
  );
}

// 5. Instellen van de filter-tabs
function setupFilterTabs() {
  const tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      // Verwijder active klasse van alle tabs
      tabs.forEach(t => t.classList.remove('active'));
      
      // Voeg toe aan geklikte tab
      e.target.classList.add('active');
      
      // Update filter en render
      state.activeFilter = e.target.getAttribute('data-filter');
      renderNewsletterList(
        state.newsletters, 
        state.activeFilter, 
        handleUnsubscribe
      );
    });
  });
}

// 6. Header acties (zoals ontkoppelen)
function setupHeaderActions() {
  const btnDisconnect = document.getElementById('btn-disconnect');
  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', () => {
      if (state.activeMode === 'gmail') {
        disconnectGmail();
      } else if (state.activeMode === 'outlook') {
        disconnectOutlook();
      }
      
      state.newsletters = [];
      btnDisconnect.style.display = 'none';
      showScreen('screen-welcome');
      
      // Reset badge
      const badge = document.getElementById('active-mode-badge');
      state.activeMode = 'demo';
      badge.className = 'mode-badge demo';
      badge.querySelector('.badge-text').textContent = 'Demo Modus';
      
      document.getElementById('opt-demo').classList.add('active');
      document.getElementById('opt-gmail').classList.remove('active');
      document.getElementById('opt-outlook').classList.remove('active');
      
      document.getElementById('gmail-setup-fields').style.display = 'none';
      document.getElementById('outlook-setup-fields').style.display = 'none';
    });
  }
}
