// Mock Service for UnclutterMail
// Simuleert het scannen van e-mails en het beheren van de nieuwsbrievenlijst

export const mockNewsletters = [
  {
    id: "m1",
    sender: "Bol.com Deals",
    email: "deals@e.bol.com",
    subject: "Dagaanbieding: Tot 40% korting op elektronica! ⚡",
    frequency: "Dagelijks",
    emailsScanned: 24,
    spamScore: 85,
    status: "active",
    unsubscribeUrl: "https://www.bol.com/nl/m/uitschrijven"
  },
  {
    id: "m2",
    sender: "LinkedIn Updates",
    email: "updates-noreply@linkedin.com",
    subject: "Jan en 3 anderen hebben je profiel bekeken deze week",
    frequency: "Wekelijks",
    emailsScanned: 7,
    spamScore: 40,
    status: "active",
    unsubscribeUrl: "https://www.linkedin.com/unsubscribe"
  },
  {
    id: "m3",
    sender: "Pinterest Inspiratie",
    email: "discover@pinterest.com",
    subject: "10 nieuwe ideeën voor jouw interieur-bord",
    frequency: "Wekelijks",
    emailsScanned: 12,
    spamScore: 65,
    status: "active",
    unsubscribeUrl: "https://www.pinterest.com/unsubscribe"
  },
  {
    id: "m4",
    sender: "Netflix Nederland",
    email: "info@netflix.com",
    subject: "Nu te streamen: Een gloednieuw seizoen van je favoriete serie 🍿",
    frequency: "Wekelijks",
    emailsScanned: 4,
    spamScore: 30,
    status: "active",
    unsubscribeUrl: "https://www.netflix.com/unsubscribe"
  },
  {
    id: "m5",
    sender: "Spotify Music",
    email: "discover@spotify.com",
    subject: "Jouw Release Radar is bijgewerkt met nieuwe muziek!",
    frequency: "Wekelijks",
    emailsScanned: 5,
    spamScore: 25,
    status: "active",
    unsubscribeUrl: "https://www.spotify.com/unsubscribe"
  },
  {
    id: "m6",
    sender: "Albert Heijn",
    email: "bonus@ah.nl",
    subject: "Persoonlijke Bonus: Extra korting op jouw favoriete producten",
    frequency: "Wekelijks",
    emailsScanned: 8,
    spamScore: 50,
    status: "active",
    unsubscribeUrl: "https://www.ah.nl/nieuwsbrief/uitschrijven"
  },
  {
    id: "m7",
    sender: "Duolingo",
    email: "duo@duolingo.com",
    subject: "⚠️ Laat Duo niet huilen! Voltooi je dagelijkse streak nu.",
    frequency: "Dagelijks",
    emailsScanned: 30,
    spamScore: 92,
    status: "active",
    unsubscribeUrl: "https://www.duolingo.com/unsubscribe"
  },
  {
    id: "m8",
    sender: "Medium Daily Digest",
    email: "noreply@medium.com",
    subject: "3 stories selected for you about web development and AI",
    frequency: "Dagelijks",
    emailsScanned: 26,
    spamScore: 70,
    status: "active",
    unsubscribeUrl: "https://medium.com/unsubscribe"
  },
  {
    id: "m9",
    sender: "Booking.com Inspiratie",
    email: "noreply@booking.com",
    subject: "Ontsnap dit weekend: 15% korting op hotels in Barcelona ✈️",
    frequency: "Wekelijks",
    emailsScanned: 15,
    spamScore: 78,
    status: "active",
    unsubscribeUrl: "https://booking.com/unsubscribe"
  },
  {
    id: "m10",
    sender: "Thuisbezorgd.nl",
    email: "info@thuisbezorgd.nl",
    subject: "Geen zin om te koken? Krijg €5 korting op je volgende bestelling!",
    frequency: "Zelden",
    emailsScanned: 3,
    spamScore: 45,
    status: "active",
    unsubscribeUrl: "https://thuisbezorgd.nl/unsubscribe"
  },
  {
    id: "m11",
    sender: "Canva Pro",
    email: "newsletters@canva.com",
    subject: "Ontdek de nieuwe AI-tools in Canva - Update nu!",
    frequency: "Zelden",
    emailsScanned: 2,
    spamScore: 35,
    status: "active",
    unsubscribeUrl: "https://canva.com/unsubscribe"
  },
  {
    id: "m12",
    sender: "Tikkie Deals",
    email: "deals@tikkie.me",
    subject: "Krijg nu geld terug op je favoriete frisdrank! 🥤",
    frequency: "Zelden",
    emailsScanned: 1,
    spamScore: 60,
    status: "active",
    unsubscribeUrl: "https://tikkie.me/unsubscribe"
  }
];

// Gesimuleerde onderwerpen om tijdens het scannen te tonen
const sampleSubjects = [
  "Bevestiging van je bestelling #98723",
  "Nieuwe inlogpoging gedetecteerd op je account",
  "Dagaanbieding: Tot 40% korting op elektronica!",
  "Factuur van je abonnement - mei 2026",
  "Jan en 3 anderen hebben je profiel bekeken...",
  "Je wekelijkse rapport staat klaar",
  "10 nieuwe ideeën voor jouw interieur-bord",
  "Belangrijke wijziging in onze algemene voorwaarden",
  "Nu te streamen: Een gloednieuw seizoen van...",
  "Jouw Release Radar is bijgewerkt met nieuwe...",
  "Afspraakbevestiging: Tandartscontrole",
  "Persoonlijke Bonus: Extra korting op jouw...",
  "Laat Duo niet huilen! Voltooi je streak nu.",
  "Je ticket voor het concert van zaterdag",
  "3 stories selected for you about web...",
  "Ontsnap dit weekend: 15% korting op hotels...",
  "Wachtwoord herstellen voor je account",
  "Geen zin om te koken? Krijg €5 korting op..."
];

export function scanMockEmails(onProgress) {
  return new Promise((resolve) => {
    let currentMailIndex = 0;
    const totalMails = 247;
    const newslettersFound = [];
    
    const interval = setInterval(() => {
      // Simuleer voortgang per e-mail
      currentMailIndex += Math.floor(Math.random() * 8) + 3;
      if (currentMailIndex >= totalMails) {
        currentMailIndex = totalMails;
        clearInterval(interval);
        
        // Sorteer mockNewsletters op basis van spamScore om het leuk te houden
        const results = mockNewsletters.map(item => ({ ...item }));
        resolve(results);
      }
      
      // Kies een willekeurig onderwerp om te flitsen in de scanner
      const randomSubject = sampleSubjects[Math.floor(Math.random() * sampleSubjects.length)];
      
      // Zoek willekeurig een nieuwsbrief uit om te "vinden" tijdens het scannen
      if (Math.random() > 0.7 && newslettersFound.length < mockNewsletters.length) {
        const nextItem = mockNewsletters[newslettersFound.length];
        if (nextItem && !newslettersFound.includes(nextItem.sender)) {
          newslettersFound.push(nextItem.sender);
        }
      }
      
      const percent = Math.round((currentMailIndex / totalMails) * 100);
      
      onProgress({
        percent,
        currentMail: currentMailIndex,
        totalMail: totalMails,
        latestSubject: randomSubject,
        foundCount: newslettersFound.length
      });
      
    }, 120); // 120ms tick rate voor een flitsende, dynamische scanner
  });
}
