// Gmail Service for UnclutterMail
// Handelt Google OAuth2 authenticatie en communiceert rechtstreeks met de Gmail REST API.

let tokenClient = null;
let accessToken = null;

// Zorgt ervoor dat de Google API Client (gapi) en de Gmail module zijn geladen
function ensureGapiLoaded() {
  return new Promise((resolve, reject) => {
    if (typeof gapi !== 'undefined' && gapi.client && gapi.client.gmail) {
      resolve();
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      if (typeof gapi !== 'undefined') {
        clearInterval(interval);
        gapi.load('client', () => {
          gapi.client.init({})
            .then(() => gapi.client.load('gmail', 'v1'))
            .then(() => {
              // Als er al een token in localStorage staat, laad die dan direct in gapi.client
              const existingToken = getExistingToken();
              if (existingToken) {
                gapi.client.setToken({ access_token: existingToken });
              }
              resolve();
            })
            .catch(err => reject(new Error(`GAPI initialisatie mislukt: ${err.message || err}`)));
        });
      } else if (Date.now() - start > 10000) {
        clearInterval(interval);
        reject(new Error('Google API Client (gapi.js) kon niet tijdig worden geladen.'));
      }
    }, 100);
  });
}

// Sla client ID op in localStorage zodat de gebruiker deze maar één keer hoeft in te voeren
export function getSavedClientId() {
  return localStorage.getItem('unclutter_gmail_client_id') || '';
}

export function saveClientId(clientId) {
  localStorage.setItem('unclutter_gmail_client_id', clientId);
}

// Initialiseer Google Identity Services en GAPI
export async function initGoogleClient(clientId, onTokenReceived, onError) {
  try {
    if (typeof google === 'undefined') {
      onError('Google Identity Services SDK is niet geladen. Controleer je internetverbinding.');
      return;
    }

    // Zorg ervoor dat de GAPI client ook is ingeladen
    await ensureGapiLoaded();

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
      callback: (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
          onError(`Fout bij aanmelden: ${tokenResponse.error_description || tokenResponse.error}`);
          return;
        }
        accessToken = tokenResponse.access_token;
        localStorage.setItem('unclutter_gmail_access_token', accessToken);
        
        // Koppel het token direct aan de GAPI client
        if (typeof gapi !== 'undefined' && gapi.client) {
          gapi.client.setToken({ access_token: accessToken });
        }
        
        onTokenReceived(accessToken);
      },
    });
  } catch (err) {
    onError(`Google initialisatie fout: ${err.message}`);
  }
}

// Start het aanmeldproces (opent Google popup)
export function requestGmailAccess() {
  if (!tokenClient) {
    throw new Error('Google client is niet geïnitialiseerd. Vul eerst een geldige Client-ID in.');
  }
  // Vraag een nieuw token aan (of hergebruik)
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

// Uitloggen
export function disconnectGmail() {
  accessToken = null;
  localStorage.removeItem('unclutter_gmail_access_token');
  // Probeer ook het token te revoken bij Google indien gewenst
}

// Controleer of we al een opgeslagen token hebben
export function getExistingToken() {
  return localStorage.getItem('unclutter_gmail_access_token');
}

// Helper om API calls te doen via de GAPI client om CORS-problemen te voorkomen
async function fetchGmailAPI(endpoint, options = {}) {
  await ensureGapiLoaded();
  
  const token = accessToken || getExistingToken();
  if (!token) {
    throw new Error('Niet geautoriseerd. Meld je eerst aan met Google.');
  }

  gapi.client.setToken({ access_token: token });

  // Splits de endpoint in het pad en eventuele query parameters
  const [pathPart, queryPart] = endpoint.split('?');
  
  const params = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    for (const [key, value] of searchParams.entries()) {
      if (params[key]) {
        if (Array.isArray(params[key])) {
          params[key].push(value);
        } else {
          params[key] = [params[key], value];
        }
      } else {
        params[key] = value;
      }
    }
  }

  // LET OP: De Gmail REST API base-URL bevat '/gmail/v1/' in plaats van '/v1/'
  // Door direct gapi.client.request te gebruiken met dit absolute pad, vermijden we bugs met ontbrekende of foutief gedefinieerde functies in de SDK
  const requestObj = {
    path: `https://gmail.googleapis.com/gmail/v1/users/me/${pathPart}`,
    method: options.method || 'GET',
    params: params
  };

  if (options.body) {
    try {
      requestObj.body = JSON.parse(options.body);
    } catch (e) {
      requestObj.body = options.body;
    }
  }

  try {
    const response = await gapi.client.request(requestObj);
    return response.result;
  } catch (err) {
    const status = err.status || err.result?.error?.code;
    const message = err.result?.error?.message || err.message || 'Onbekende API fout';
    
    if (status === 401) {
      localStorage.removeItem('unclutter_gmail_access_token');
      accessToken = null;
      throw new Error('Sessie verlopen. Meld je opnieuw aan.');
    }
    
    throw new Error(`Gmail API fout (${status}): ${message}`);
  }
}

// Scant de Gmail inbox op nieuwsbrieven
export async function scanRealGmail(onProgress) {
  onProgress({ percent: 5, currentMail: 0, totalMail: 0, latestSubject: "Verbinding maken met Gmail...", foundCount: 0 });
  
  // 1. Zoek naar e-mails die 'unsubscribe', 'uitschrijven' of 'afmelden' bevatten.
  // Dit is veel sneller en efficiënter dan alle e-mails scannen.
  const query = "unsubscribe OR uitschrijven OR afmelden OR opt-out";
  const searchResults = await fetchGmailAPI(`messages?maxResults=100&q=${encodeURIComponent(query)}`);
  
  const messages = searchResults.messages || [];
  const totalMail = messages.length;
  
  if (totalMail === 0) {
    onProgress({ percent: 100, currentMail: 0, totalMail: 0, latestSubject: "Geen nieuwsbrieven gevonden!", foundCount: 0 });
    return [];
  }

  const newsletterMap = new Map();
  let currentMail = 0;

  // Haal de metadata op voor elke kandidaat-email
  for (const msg of messages) {
    try {
      currentMail++;
      const detail = await fetchGmailAPI(`messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`);
      
      const headers = detail.payload.headers || [];
      const fromHeader = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
      const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(Geen onderwerp)';
      const listUnsubscribeHeader = headers.find(h => h.name.toLowerCase() === 'list-unsubscribe')?.value || '';

      // Parse de 'From' header naar een naam en e-mailadres
      let senderName = "Onbekende Afzender";
      let senderEmail = "";
      
      const emailRegex = /<(.+?)>/;
      const match = fromHeader.match(emailRegex);
      if (match) {
        senderEmail = match[1];
        senderName = fromHeader.replace(emailRegex, '').replace(/"/g, '').trim() || senderEmail;
      } else {
        senderEmail = fromHeader.trim();
        senderName = senderEmail;
      }

      // Alleen verwerken als er een List-Unsubscribe header is óf als we trefwoorden vinden
      const isNewsletter = listUnsubscribeHeader || 
                           subjectHeader.toLowerCase().includes('nieuwsbrief') || 
                           subjectHeader.toLowerCase().includes('newsletter');

      if (isNewsletter && senderEmail) {
        // Indien we deze afzender al hebben gezien, tellen we de e-mails op
        if (newsletterMap.has(senderEmail)) {
          const existing = newsletterMap.get(senderEmail);
          existing.emailsScanned++;
          // Behoud de meest recente onderwerpregel
        } else {
          // Bepaal de frequentie (geschat op basis van aantal emails, maar in deze snelle scan zetten we het standaard)
          let frequency = "Zelden";
          
          // Parse List-Unsubscribe link
          let unsubscribeUrl = "";
          let unsubscribeMailto = "";
          
          if (listUnsubscribeHeader) {
            // List-Unsubscribe kan er zo uitzien: <https://example.com/unsub>, <mailto:unsub@example.com>
            const links = listUnsubscribeHeader.split(',').map(l => l.trim());
            for (const link of links) {
              if (link.startsWith('<https://') || link.startsWith('<http://')) {
                unsubscribeUrl = link.substring(1, link.length - 1);
              } else if (link.startsWith('<mailto:')) {
                unsubscribeMailto = link.substring(1, link.length - 1);
              }
            }
          }

          newsletterMap.set(senderEmail, {
            id: msg.id, // Gebruik het e-mail ID als referentie
            sender: senderName,
            email: senderEmail,
            subject: subjectHeader,
            frequency: "Wekelijks", // Standaard schatting
            emailsScanned: 1,
            spamScore: listUnsubscribeHeader ? 40 : 70, // Zonder list-unsubscribe is het vaak meer 'spam'
            status: "active",
            unsubscribeUrl,
            unsubscribeMailto
          });
        }
      }

      // Update voortgang
      const percent = Math.round((currentMail / totalMail) * 90) + 5; // Schaal van 5% tot 95%
      onProgress({
        percent,
        currentMail,
        totalMail,
        latestSubject: subjectHeader,
        foundCount: newsletterMap.size
      });

    } catch (e) {
      console.warn("Fout bij ophalen e-mail metadata:", e);
    }
  }

  // Zet map om naar een array
  const results = Array.from(newsletterMap.values());
  
  // Update naar 100%
  onProgress({
    percent: 100,
    currentMail: totalMail,
    totalMail,
    latestSubject: "Scan voltooid!",
    foundCount: results.length
  });

  return results;
}

// Voert de uitschrijf-actie uit voor een echte Gmail nieuwsbrief
export async function unsubscribeRealGmail(newsletter) {
  try {
    // Stap 1: Als er een List-Unsubscribe mailto-link is, stuur dan een e-mail naar dat adres
    if (newsletter.unsubscribeMailto) {
      await sendUnsubscribeEmail(newsletter.unsubscribeMailto);
    }

    // Stap 2: Probeer ook de HTTP link te bezoeken (dit kan geblokkeerd worden door CORS als we het via fetch doen,
    // daarom raden we in de UI ook aan om de link in een nieuw tabblad te openen als fallback).
    if (newsletter.unsubscribeUrl) {
      try {
        await fetch(newsletter.unsubscribeUrl, { mode: 'no-cors' });
      } catch (e) {
        console.warn("Kon unsubscribe URL niet geruisloos bezoeken (CORS of netwerk):", e);
      }
    }

    // Stap 3: Archiveer en markeer alle e-mails van deze afzender als gelezen, of verplaats ze naar de prullenbak.
    // Dit zorgt ervoor dat de inbox direct wordt opgeschoond!
    await trashAllFromSender(newsletter.email);

    return { success: true };
  } catch (err) {
    console.error("Fout tijdens uitschrijven:", err);
    throw err;
  }
}

// Stuurt een geautomatiseerde unsubscribe mail via de Gmail API
async function sendUnsubscribeEmail(mailtoUri) {
  // mailtoUri format: unsubscribe@domain.com?subject=unsubscribe
  const url = new URL(mailtoUri.replace('mailto:', 'http://dummy.com/')); // Truc om makkelijk te parsen
  const to = mailtoUri.split('?')[0].replace('mailto:', '');
  const subject = url.searchParams.get('subject') || 'Unsubscribe';
  const body = 'Please unsubscribe me from this newsletter.';

  // Bouw een RFC 2822 e-mail
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body
  ];
  const email = emailLines.join('\r\n');

  // Base64url encode het bericht
  const encodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await fetchGmailAPI('messages/send', {
    method: 'POST',
    body: JSON.stringify({
      raw: encodedEmail
    })
  });
}

// Verplaatst alle e-mails van een specifieke afzender naar de prullenbak via batchModify
async function trashAllFromSender(senderEmail) {
  // 1. Zoek alle berichten van deze afzender
  const query = `from:${senderEmail}`;
  const searchResults = await fetchGmailAPI(`messages?q=${encodeURIComponent(query)}`);
  
  const messages = searchResults.messages || [];
  if (messages.length === 0) return;

  const ids = messages.map(m => m.id);

  // 2. Batch verplaatsen naar trash via batchModify (dit is veel robuuster en universeel ondersteund op alle GAPI proxies)
  await fetchGmailAPI('messages/batchModify', {
    method: 'POST',
    body: JSON.stringify({
      ids: ids,
      addLabelIds: ['TRASH'],
      removeLabelIds: ['INBOX']
    })
  });
}

