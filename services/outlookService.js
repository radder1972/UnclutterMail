// Outlook / Hotmail Service voor UnclutterMail
// Handelt Microsoft MSAL authenticatie af en communiceert rechtstreeks met de Microsoft Graph REST API.

let msalInstance = null;
let accessToken = null;
let activeAccount = null;

export const DEFAULT_OUTLOOK_CLIENT_ID = 'b3658514-a957-4148-8dfa-ce3db8255ee8'; // Standaard ingebouwde Microsoft Client-ID

// Sla client ID op in localStorage zodat de gebruiker deze maar één keer hoeft in te voeren
export function getSavedClientId() {
  return localStorage.getItem('unclutter_outlook_client_id') || '';
}

export function saveClientId(clientId) {
  localStorage.setItem('unclutter_outlook_client_id', clientId);
}

// Sla Outlook-adres op in localStorage zodat de gebruiker deze maar één keer hoeft in te voeren
export function getSavedEmailAddress() {
  return localStorage.getItem('unclutter_outlook_email_address') || '';
}

export function saveEmailAddress(email) {
  localStorage.setItem('unclutter_outlook_email_address', email);
}

// Initialiseer MSAL Client
export async function initOutlookClient(clientId, onError) {
  try {
    if (typeof msal === 'undefined') {
      onError('Microsoft MSAL Browser SDK is niet geladen. Controleer je internetverbinding.');
      return false;
    }

    const msalConfig = {
      auth: {
        clientId: clientId,
        authority: "https://login.microsoftonline.com/common", // Ondersteunt zowel werk/school als persoonlijke MS-accounts
        redirectUri: window.location.origin,
        navigateToLoginRequestUrl: false
      },
      cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false
      }
    };

    msalInstance = new msal.PublicClientApplication(msalConfig);
    
    // Verwerk eventuele redirects van de login (hoewel we popup gebruiken)
    await msalInstance.handleRedirectPromise();

    // Check of er al een actieve sessie is
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
      activeAccount = accounts[0];
      
      // Probeer stilzwijgend een token te verkrijgen
      try {
        const tokenResponse = await msalInstance.acquireTokenSilent({
          scopes: ["User.Read", "Mail.ReadWrite"],
          account: activeAccount
        });
        accessToken = tokenResponse.accessToken;
        return true;
      } catch (err) {
        console.warn("Stilzwijgende token-aanvraag mislukt, gebruiker moet handmatig inloggen:", err);
        return false;
      }
    }
    return false;
  } catch (err) {
    onError(`Microsoft initialisatie fout: ${err.message}`);
    return false;
  }
}

export async function requestOutlookAccess(loginHint) {
  if (!msalInstance) {
    throw new Error('Microsoft client is niet geïnitialiseerd.');
  }

  const loginRequest = {
    scopes: ["User.Read", "Mail.ReadWrite"]
  };

  if (loginHint) {
    loginRequest.loginHint = loginHint;
  } else {
    loginRequest.prompt = "select_account";
  }

  const loginResponse = await msalInstance.loginPopup(loginRequest);
  msalInstance.setActiveAccount(loginResponse.account);
  activeAccount = loginResponse.account;
  accessToken = loginResponse.accessToken;
  
  return accessToken;
}

// Uitloggen / Ontkoppelen
export function disconnectOutlook() {
  accessToken = null;
  activeAccount = null;
  localStorage.removeItem('unclutter_outlook_access_token');
  
  if (msalInstance) {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      // Log uit via popup of clear local cache
      // Om vastlopen of redirects te vermijden, clearen we sessionStorage
      sessionStorage.clear();
    }
  }
}

// Helper om Microsoft Graph REST API calls uit te voeren
async function fetchGraphAPI(endpoint, options = {}) {
  if (!msalInstance) {
    throw new Error('Microsoft client is niet geïnitialiseerd.');
  }

  // Zorg ervoor dat het token nog geldig is en vernieuw het stilzwijgend indien nodig
  if (activeAccount) {
    try {
      const tokenResponse = await msalInstance.acquireTokenSilent({
        scopes: ["User.Read", "Mail.ReadWrite"],
        account: activeAccount
      });
      accessToken = tokenResponse.accessToken;
    } catch (err) {
      console.warn("Mislukt om token geruisloos te vernieuwen, opnieuw aanmelden vereist.", err);
      throw new Error("Sessie met Microsoft is verlopen. Meld je opnieuw aan.");
    }
  }

  const token = accessToken;
  if (!token) {
    throw new Error('Niet geautoriseerd. Meld je eerst aan met Microsoft.');
  }

  const headers = new Headers();
  headers.append("Authorization", `Bearer ${token}`);
  headers.append("Content-Type", "application/json");

  const fetchOptions = {
    method: options.method || 'GET',
    headers: headers
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0/${endpoint}`, fetchOptions);

  if (response.status === 204) {
    return null; // Geen content (bijv. bij DELETE)
  }

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `Microsoft Graph API fout (${response.status})`;
    try {
      const errJSON = JSON.parse(errText);
      errMsg = errJSON.error?.message || errMsg;
    } catch (e) {}
    throw new Error(errMsg);
  }

  return await response.json();
}

// Scant de Outlook inbox op nieuwsbrieven
export async function scanRealOutlook(onProgress) {
  onProgress({ percent: 5, currentMail: 0, totalMail: 0, latestSubject: "Verbinding maken met Microsoft Graph...", foundCount: 0 });

  // 1. Haal de 80 meest recente e-mails op uit de inbox
  // We vragen specifiek naar internetMessageHeaders om de List-Unsubscribe te achterhalen
  const selectQuery = "id,subject,from,sender,internetMessageHeaders,bodyPreview,receivedDateTime";
  const messagesData = await fetchGraphAPI(`me/mailFolders/inbox/messages?$top=80&$select=${selectQuery}&$orderby=receivedDateTime desc`);
  
  const messages = messagesData.value || [];
  const totalMail = messages.length;

  if (totalMail === 0) {
    onProgress({ percent: 100, currentMail: 0, totalMail: 0, latestSubject: "Geen e-mails gevonden in je Inbox!", foundCount: 0 });
    return [];
  }

  const newsletterMap = new Map();
  let currentMail = 0;

  for (const msg of messages) {
    try {
      currentMail++;
      const percent = Math.round((currentMail / totalMail) * 95);
      
      const subjectHeader = msg.subject || "(Geen onderwerp)";
      const fromHeader = msg.from?.emailAddress || {};
      const senderName = fromHeader.name || "Onbekende Afzender";
      const senderEmail = fromHeader.address || "";
      
      // Update voortgang
      onProgress({ 
        percent: percent, 
        currentMail: currentMail, 
        totalMail: totalMail, 
        latestSubject: subjectHeader.substring(0, 35) + (subjectHeader.length > 35 ? "..." : ""),
        foundCount: newsletterMap.size 
      });

      if (!senderEmail) continue;

      // Vind de List-Unsubscribe header in de internetMessageHeaders array
      const headers = msg.internetMessageHeaders || [];
      const listUnsubscribeHeaderObj = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe');
      const listUnsubscribeHeader = listUnsubscribeHeaderObj ? listUnsubscribeHeaderObj.value : "";

      // Analyseer of dit een nieuwsbrief is
      const isNewsletter = listUnsubscribeHeader || 
                           subjectHeader.toLowerCase().includes('nieuwsbrief') || 
                           subjectHeader.toLowerCase().includes('newsletter') ||
                           msg.bodyPreview?.toLowerCase().includes('unsubscribe') ||
                           msg.bodyPreview?.toLowerCase().includes('uitschrijven') ||
                           msg.bodyPreview?.toLowerCase().includes('afmelden');

      if (isNewsletter) {
        if (newsletterMap.has(senderEmail)) {
          const existing = newsletterMap.get(senderEmail);
          existing.emailsScanned++;
          // Sla alle gekoppelde message-ids op om ze in één keer te kunnen opschonen/verwijderen
          existing.messageIds.push(msg.id);
        } else {
          // Bepaal uitschrijflinks uit de List-Unsubscribe header
          let unsubscribeUrl = "";
          let unsubscribeMailto = "";

          if (listUnsubscribeHeader) {
            // Header parsen, kan zijn: <https://example.com/unsub>, <mailto:unsub@example.com>
            const links = listUnsubscribeHeader.split(',').map(l => l.trim());
            for (const link of links) {
              if (link.startsWith('<https://') || link.startsWith('<http://')) {
                unsubscribeUrl = link.substring(1, link.length - 1);
              } else if (link.startsWith('<mailto:')) {
                unsubscribeMailto = link.substring(1, link.length - 1);
              }
            }
          }

          // Spamscore inschatten op basis van factoren
          let spamScore = 40;
          if (listUnsubscribeHeader) spamScore += 15;
          if (subjectHeader.toLowerCase().includes('fw:') || subjectHeader.toLowerCase().includes('re:')) spamScore -= 20;
          if (senderEmail.includes('newsletter') || senderEmail.includes('nieuws')) spamScore += 15;
          spamScore = Math.min(Math.max(spamScore, 10), 99);

          newsletterMap.set(senderEmail, {
            id: msg.id,
            messageIds: [msg.id],
            sender: senderName,
            email: senderEmail,
            subject: subjectHeader,
            frequency: "Wekelijks", // Standaard schatting
            emailsScanned: 1,
            spamScore: spamScore,
            status: 'active',
            unsubscribeUrl: unsubscribeUrl,
            unsubscribeMailto: unsubscribeMailto
          });
        }
      }
    } catch (err) {
      console.warn("Fout bij verwerken van Microsoft e-mail:", err);
    }
  }

  // Converteer naar array en geef het terug
  const newsletters = Array.from(newsletterMap.values());
  
  onProgress({ 
    percent: 100, 
    currentMail: totalMail, 
    totalMail: totalMail, 
    latestSubject: "Scan voltooid! 🎉", 
    foundCount: newsletters.length 
  });

  return newsletters;
}

// Schoon de nieuwsbrief op (verplaats alle e-mails naar Deleted Items / Trash)
export async function cleanNewsletterOutlook(newsletter) {
  if (!newsletter.messageIds || newsletter.messageIds.length === 0) {
    // Fallback: zoek e-mails van deze afzender en verwijder ze
    const searchData = await fetchGraphAPI(`me/messages?$filter=from/emailAddress/address eq '${newsletter.email}'&$select=id`);
    newsletter.messageIds = (searchData.value || []).map(m => m.id);
  }

  if (newsletter.messageIds && newsletter.messageIds.length > 0) {
    // Verwijder de e-mails een voor een
    // Microsoft Graph DELETE /me/messages/{id} verplaatst de e-mail direct naar de Deleted Items map
    const deletePromises = newsletter.messageIds.map(id => 
      fetchGraphAPI(`me/messages/${id}`, { method: 'DELETE' })
        .catch(err => console.warn(`Kon e-mail ${id} niet verwijderen van Microsoft:`, err))
    );
    await Promise.all(deletePromises);
  }

  newsletter.status = 'unsubscribed';
  return true;
}
