// UI Module for UnclutterMail
// Verantwoordelijk voor alle DOM-manipulaties en het renderen van de interface.

// Wisselen tussen verschillende schermen
export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
    // Scroll naar boven bij schermwissel
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Update de scanner-interface live tijdens het scannen
export function updateScannerUI(data) {
  const percentText = document.getElementById('scan-percent');
  const progressFill = document.getElementById('scan-progress-fill');
  const countText = document.getElementById('scan-count');
  const subjectText = document.getElementById('scan-subject');
  const foundText = document.getElementById('scan-found-count');

  if (percentText) percentText.textContent = `${data.percent}%`;
  if (progressFill) progressFill.style.width = `${data.percent}%`;
  
  if (countText) {
    countText.textContent = `${data.currentMail} van de ${data.totalMail} e-mails`;
  }
  
  if (subjectText) {
    subjectText.textContent = data.latestSubject || "Analyseren...";
  }

  if (foundText) {
    foundText.textContent = data.foundCount;
  }
}

// Update de dashboard statistieken op basis van de nieuwsbrievenlijst
export function updateStatsUI(newsletters) {
  const totalCount = newsletters.length;
  const unsubscribedCount = newsletters.filter(n => n.status === 'unsubscribed').length;
  const activeCount = totalCount - unsubscribedCount;
  
  // Berekeningen voor premium statistieken
  // Gemiddeld besteedt men 3 minuten per nieuwsbrief per maand aan lezen/verwijderen
  const timeSavedMinutes = unsubscribedCount * 3.5;
  const timeSavedText = timeSavedMinutes >= 60 
    ? `${Math.floor(timeSavedMinutes / 60)}u ${Math.round(timeSavedMinutes % 60)}m`
    : `${Math.round(timeSavedMinutes)} min`;

  // CO2 besparing: gemiddeld 0.3g CO2 per e-mail. 
  // We schatten dat uitschrijven 4 e-mails per maand bespaart per nieuwsbrief.
  const co2SavedGrams = unsubscribedCount * 4 * 0.3;
  const co2Text = co2SavedGrams >= 1000
    ? `${(co2SavedGrams / 1000).toFixed(2)} kg`
    : `${Math.round(co2SavedGrams)} g`;

  // Update de DOM elements
  const totalEl = document.getElementById('stat-total');
  const activeEl = document.getElementById('stat-active');
  const unsubbedEl = document.getElementById('stat-unsubscribed');
  const co2El = document.getElementById('stat-co2');

  if (totalEl) totalEl.textContent = totalCount;
  if (activeEl) activeEl.textContent = activeCount;
  
  if (unsubbedEl) {
    unsubbedEl.textContent = unsubscribedCount;
    // Voeg een kleine animatie-puls toe als dit aantal stijgt
    unsubbedEl.classList.remove('pulse');
    void unsubbedEl.offsetWidth; // Trigger reflow
    unsubbedEl.classList.add('pulse');
  }

  if (co2El) {
    co2El.innerHTML = `${co2Text} <span style="font-size: 0.9rem; font-weight: normal; color: var(--success);">tijd: ${timeSavedText}</span>`;
  }

  // Update quick-clean status box in het zijpaneel
  const quickCleanTitle = document.getElementById('quick-clean-title');
  const quickCleanDesc = document.getElementById('quick-clean-desc');
  
  if (quickCleanTitle && quickCleanDesc) {
    if (activeCount === 0 && totalCount > 0) {
      quickCleanTitle.textContent = "Mailbox is Opgeruimd! 🎉";
      quickCleanDesc.textContent = "Gefeliciteerd! Je bent van alle gedetecteerde nieuwsbrieven uitgeschreven.";
    } else {
      quickCleanTitle.textContent = "Snel Opschonen";
      quickCleanDesc.textContent = `Je bent nog geabonneerd op ${activeCount} nieuwsbrieven.`;
    }
  }
}

// Rendert de lijst met nieuwsbrieven met filters
export function renderNewsletterList(newsletters, activeFilter = 'all', onUnsubscribe) {
  const container = document.getElementById('newsletters-container');
  if (!container) return;

  container.innerHTML = '';

  // Filter de lijst
  const filtered = newsletters.filter(item => {
    if (activeFilter === 'active') return item.status === 'active';
    if (activeFilter === 'unsubscribed') return item.status === 'unsubscribed';
    return true; // 'all'
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <span style="font-size: 3rem; display: block; margin-bottom: 1rem;">Inbox is Clean ☀️</span>
        <p>Geen nieuwsbrieven gevonden die voldoen aan dit filter.</p>
      </div>
    `;
    return;
  }

  // Sorteer: actieve nieuwsbrieven met de hoogste spamscore bovenaan
  filtered.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'active' ? -1 : 1;
    }
    return b.spamScore - a.spamScore;
  });

  filtered.forEach(item => {
    const isUnsubscribed = item.status === 'unsubscribed';
    
    const card = document.createElement('div');
    card.className = `newsletter-item ${isUnsubscribed ? 'unsubscribed' : ''}`;
    card.setAttribute('data-id', item.id);

    // E-mail info blok
    const infoDiv = document.createElement('div');
    infoDiv.className = 'newsletter-info';

    const senderRow = document.createElement('div');
    senderRow.className = 'newsletter-sender-row';

    const senderSpan = document.createElement('span');
    senderSpan.className = 'newsletter-sender';
    senderSpan.textContent = item.sender;

    const emailSpan = document.createElement('span');
    emailSpan.className = 'newsletter-email';
    emailSpan.textContent = `<${item.email}>`;

    senderRow.appendChild(senderSpan);
    senderRow.appendChild(emailSpan);

    const subjectP = document.createElement('p');
    subjectP.className = 'newsletter-subject';
    subjectP.textContent = item.subject;

    // Tags rij
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'newsletter-tags';
    tagsDiv.style.display = 'flex';
    tagsDiv.style.gap = '0.5rem';
    tagsDiv.style.marginTop = '0.5rem';

    const freqTag = document.createElement('span');
    freqTag.className = 'tag tag-freq';
    freqTag.textContent = item.frequency;

    const scoreTag = document.createElement('span');
    scoreTag.className = 'tag tag-score';
    scoreTag.textContent = `Spam: ${item.spamScore}%`;

    tagsDiv.appendChild(freqTag);
    tagsDiv.appendChild(scoreTag);

    if (item.emailsScanned > 1) {
      const countTag = document.createElement('span');
      countTag.className = 'tag';
      countTag.style.background = 'rgba(255,255,255,0.05)';
      countTag.textContent = `${item.emailsScanned} mails`;
      tagsDiv.appendChild(countTag);
    }

    infoDiv.appendChild(senderRow);
    infoDiv.appendChild(subjectP);
    infoDiv.appendChild(tagsDiv);

    // Actie knoppen
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'newsletter-actions';

    if (isUnsubscribed) {
      actionsDiv.innerHTML = `
        <span class="unsubscribed-check">
          Done ✓
        </span>
      `;
    } else {
      const unsubBtn = document.createElement('button');
      unsubBtn.className = 'btn-unsub';
      unsubBtn.innerHTML = `
        <span class="unsub-icon">✉</span> Uitschrijven
      `;
      
      unsubBtn.addEventListener('click', async () => {
        // Zet knop in laadstatus
        unsubBtn.disabled = true;
        unsubBtn.innerHTML = `<span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span> Lokaal verwerken...`;
        
        try {
          await onUnsubscribe(item);
          // Succes! Confetti en trigger de animatie
          showConfetti();
        } catch (err) {
          unsubBtn.disabled = false;
          unsubBtn.innerHTML = `⚠️ Mislukt`;
          alert(`Er is een fout opgetreden: ${err.message}`);
        }
      });

      actionsDiv.appendChild(unsubBtn);

      // Als er een directe url is, tonen we optioneel een directe link knop
      if (item.unsubscribeUrl) {
        const linkBtn = document.createElement('a');
        linkBtn.href = item.unsubscribeUrl;
        linkBtn.target = '_blank';
        linkBtn.className = 'btn';
        linkBtn.style.padding = '0.5rem';
        linkBtn.style.borderRadius = '10px';
        linkBtn.title = "Open originele uitschrijflink in nieuw tabblad";
        linkBtn.innerHTML = '🔗';
        actionsDiv.appendChild(linkBtn);
      }
    }

    card.appendChild(infoDiv);
    card.appendChild(actionsDiv);
    container.appendChild(card);
  });
}

// Genereert een spectaculair lokaal confettiregen effect direct in de browser
export function showConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  container.style.display = 'block';
  
  const colors = ['#00f2fe', '#4facfe', '#7f00ff', '#ff6b6b', '#81c784'];
  const symbols = ['🎉', '✨', '✓', '⭐', '🎈'];

  for (let i = 0; i < 40; i++) {
    const particle = document.createElement('div');
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    particle.style.position = 'absolute';
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.top = '-20px';
    particle.style.fontSize = `${Math.random() * 1.5 + 1}rem`;
    particle.style.color = randomColor;
    particle.textContent = randomSymbol;
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '9999';
    
    // Custom vlieg-animatie
    const duration = Math.random() * 2 + 1.5; // 1.5s tot 3.5s
    const drift = Math.random() * 200 - 100; // zijwaartse drift
    
    particle.animate([
      { transform: `translateY(0px) rotate(0deg)`, opacity: 1 },
      { transform: `translateY(105vh) translateX(${drift}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
    ], {
      duration: duration * 1000,
      easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)',
      fill: 'forwards'
    });

    container.appendChild(particle);
    
    // Verwijder element na animatie
    setTimeout(() => {
      particle.remove();
    }, duration * 1000);
  }

  // Verberg de laag na een tijdje
  setTimeout(() => {
    if (container.children.length === 0) {
      container.style.display = 'none';
    }
  }, 4000);
}
