// Résultat complet du mini-test des drivers, envoyé par mail.
// La page /drivers/ affiche les 12 cartes, puis le driver dominant et les trois scores.
// Elle appelle ensuite cette fonction avec le prénom, l'adresse et les 12 réponses (0 à 3). Elle :
//   1. recalcule les scores et le driver dominant (le texte du mail ne vient jamais du navigateur) ;
//   2. ajoute le contact aux listes Brevo 3 et 4, avec son résultat (champs DRIVER_*) ;
//   3. envoie le résultat complet par mail, puis une copie à contact@kokolawson.com ;
//   4. renvoie le résultat à la page, qui ne l'affiche en entier que si le mail n'a pas pu partir.
//
// Variable d'environnement Netlify : BREVO_API_KEY (comme resultat-quiz et inscription-live).
// Les affirmations, l'ordre des drivers et les seuils sont repris dans /drivers/index.html :
// les garder identiques. Texte source validé : Projets/Lead magnet drivers/mini-test-drivers.md.

import process from "node:process";

const LISTE_LIVE = 3;
const LISTE_NEWSLETTER = 4;
const BREVO = "https://api.brevo.com/v3";
const SITE = "https://kokolawson.com";
const EXPEDITEUR = { name: "Koko Lawson Adoté", email: "contact@kokolawson.com" };
const REPONSES = ["Jamais", "Parfois", "Souvent", "Presque toujours"];

// Dans l'ordre des cartes. Les drivers alternent : parfait, plaisir, fort.
const AFFIRMATIONS = [
  ["parfait", "Je relis plusieurs fois un document, même quand le délai est court."],
  ["plaisir", "J'accepte une demande alors que mon agenda est déjà plein."],
  ["fort", "Je préfère gérer seul·e une situation difficile plutôt que demander de l'aide."],
  ["parfait", "Il m'arrive de retarder un rendu parce que je vérifie encore."],
  ["plaisir", "En réunion, j'hésite à contredire une idée, de peur de froisser."],
  ["fort", "J'accepte une charge de travail lourde sans signaler que c'est trop."],
  ["parfait", "Une petite erreur peut occuper mon esprit toute la soirée."],
  ["plaisir", "Je me sens responsable de l'humeur des personnes autour de moi."],
  ["fort", "Au travail, montrer que quelque chose me touche me semble être un signe de faiblesse."],
  ["parfait", "Je vis un retour sur mon travail comme un jugement sur moi."],
  ["plaisir", "Après un échange tendu, je me demande pendant des heures si l'autre m'en veut."],
  ["fort", "Je continue à travailler même quand je suis épuisé·e ou malade."],
];

const ORDRE = ["parfait", "plaisir", "fort"];
const SEUIL_DISCRET = 4; // 0 à 4 discret, 5 à 8 présent, 9 à 12 très présent

const DRIVERS = {
  parfait: {
    emoji: "🎯", nom: "Sois parfait·e",
    message: "« Tu dois faire mieux. Une erreur prouve que tu n'es pas à la hauteur. »",
    cachee: "« Est-ce qu'on m'aimera encore si je fais une erreur ? »",
    force: "Un travail précis, fiable, soigné. Une vraie exigence de qualité.",
    trop: "Au bureau, tu vérifies encore quand il faudrait livrer, tu as du mal à déléguer et tu vis chaque retour comme un jugement. À la maison, rien n'est jamais vraiment terminé, donc tu ne te reposes jamais vraiment.",
    reperer: "Tes phrases se remplissent de précisions, de nuances et de parenthèses, pour être sûr·e d'être exact·e.",
    permission: "« J'ai le droit d'être suffisamment bien, et de me tromper sans perdre ma valeur. »",
    quickWin: "Pour tes mails non critiques, une seule relecture, puis envoi. En fin de semaine, compte combien d'erreurs on t'a signalées.",
    pistes: [
      "Avant une tâche, décide ce que veut dire « suffisamment bien » pour elle, et arrête-toi là.",
      "Quand une erreur arrive, traite-la comme une information : qu'est-ce qu'elle t'apprend pour la prochaine fois ?",
    ],
    question: "« Qu'est-ce que je crains qu'il arrive si je ne suis pas parfait·e ? »",
  },
  fort: {
    emoji: "🪨", nom: "Sois fort·e",
    message: "« Ne laisse pas les autres te voir faible. »",
    cachee: "« Que se passe-t-il si j'ai besoin des autres ? »",
    force: "Le calme sous pression, l'endurance, le sang-froid en pleine crise.",
    trop: "Au bureau, tu acceptes des charges très lourdes sans le dire, tu ne demandes pas d'aide et tu continues malgré la fatigue, jusqu'à l'épuisement. À la maison, ce que tu as retenu toute la journée peut déborder sur tes proches.",
    reperer: "Tu racontes ce qui est difficile sans dire ce que tu ressens. Tu parles des faits, rarement de toi.",
    permission: "« J'ai le droit d'avoir des besoins, de les dire et de demander de l'aide. »",
    quickWin: "Une fois dans la semaine, demande un coup de main : « Peux-tu prendre X ? J'ai besoin de me concentrer sur Y. »",
    pistes: [
      "Une fois par jour, dis ce que tu ressens en commençant par « je » : « je suis fatigué·e », « ça m'a agacé·e ».",
      "Avant de rentrer chez toi, prends 5 minutes pour noter ce que tu as retenu dans la journée.",
    ],
    question: "« Qu'est-ce que je crains qu'on pense de moi si je montre que c'est difficile ? »",
  },
  plaisir: {
    emoji: "🤝", nom: "Fais plaisir",
    message: "« Tu as de la valeur quand tu prends soin des autres et qu'ils sont contents de toi. »",
    cachee: "« Est-ce que j'existe encore si je te déçois ? »",
    force: "L'empathie, le tact, le sens du collectif. Une personne sur qui l'équipe s'appuie.",
    trop: "Au bureau, tu dis oui à tout, tu évites de contredire, tu prends les critiques personnellement et tu te sens responsable de l'humeur des autres. À la maison, tu passes en dernier, et le ressentiment s'accumule en silence.",
    reperer: "Tu cherches l'approbation dans le regard de l'autre, et tes phrases montent en fin de ligne, comme pour demander une validation.",
    permission: "« J'ai le droit de me prendre en compte et de dire non. »",
    quickWin: "À la prochaine demande non urgente, ne dis pas oui tout de suite : « Je regarde mon planning et je te reviens demain. » Puis décide à froid.",
    pistes: [
      "Avant une réunion, écris ton avis en une phrase, pour le garder même si la discussion tourne.",
      "Après un échange tendu, sépare deux choses : ce que l'autre ressent lui appartient, ce que tu as dit t'appartient.",
    ],
    question: "« Si je disais non, qu'est-ce que je crains de perdre ? »",
  },
};

const DISCRETS = {
  emoji: "🌿", nom: "Tes drivers restent discrets",
  texte: "Aucun des trois drivers ne pilote tes journées. Tu t'en sers plutôt comme de ressources : rigueur, endurance, attention aux autres.",
  observer: "Les drivers se voient surtout sous stress. Lors de ta prochaine semaine chargée, regarde lequel des trois se réveille.",
  question: "« Quand je suis sous pression, est-ce que je deviens plus exigeant·e, plus fermé·e ou plus conciliant·e ? »",
};

export const config = { path: "/api/resultat-drivers" };

export default async (req) => {
  if (req.method !== "POST") return json({ erreur: "Méthode non autorisée" }, 405);

  const origine = req.headers.get("origin") || "";
  if (!/^https:\/\/(www\.)?kokolawson\.com$|^https:\/\/[\w-]+(--[\w-]+)?\.netlify\.app$/.test(origine)) {
    return json({ erreur: "Origine refusée" }, 403);
  }

  let donnees;
  try {
    donnees = await req.json();
  } catch {
    return json({ erreur: "Contenu illisible" }, 400);
  }

  const email = String(donnees.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return json({ erreur: "Adresse mail invalide" }, 400);
  }
  const prenom = String(donnees.prenom || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
  const reponses = Array.isArray(donnees.reponses) ? donnees.reponses.map(Number) : [];
  if (reponses.length !== AFFIRMATIONS.length || reponses.some((r) => !Number.isInteger(r) || r < 0 || r > 3)) {
    return json({ erreur: "Réponses incomplètes" }, 400);
  }

  const resultat = calcule(reponses);

  // Anti-robot : un envoi moins d'une seconde après l'affichage du formulaire n'est pas humain.
  // Rien n'est envoyé ni enregistré, mais le résultat revient à la page.
  if (!(Number(donnees.delai) >= 1000)) return json({ envoye: false, raison: "rapide", ...resultat }, 200);

  const cleBrevo = process.env.BREVO_API_KEY;
  if (!cleBrevo) {
    console.error("Configuration incomplète : BREVO_API_KEY absent");
    return json({ envoye: false, raison: "cle", ...resultat }, 200);
  }
  const entetes = { "api-key": cleBrevo, "content-type": "application/json", accept: "application/json" };

  // Champs DRIVER_* à créer dans Brevo avant la mise en ligne. Un nouveau test écrase le précédent.
  const contact = await fetch(`${BREVO}/contacts`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      email,
      attributes: {
        ...(prenom ? { PRENOM: prenom } : {}),
        DRIVER_DOMINANT: resultat.titre,
        DRIVER_SCORES: scoresTexte(resultat.scores),
        DRIVER_DATE: new Date().toISOString().slice(0, 10),
      },
      listIds: [LISTE_LIVE, LISTE_NEWSLETTER],
      updateEnabled: true,
    }),
  });
  if (!contact.ok) console.error("Contact Brevo refusé", contact.status, await contact.text());

  const html = mail({ prenom, ...resultat });
  const envoi = await fetch(`${BREVO}/smtp/email`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      sender: EXPEDITEUR,
      replyTo: { email: EXPEDITEUR.email },
      to: [prenom ? { email, name: prenom } : { email }],
      subject: resultat.discrets ? "Tes drivers restent discrets" : `${resultat.dominants.length > 1 ? "Tes drivers dominants" : "Ton driver dominant"} : ${resultat.titre}`,
      htmlContent: html,
      tags: ["drivers"],
    }),
  });
  const raison = envoi.ok ? "" : `brevo ${envoi.status}`;
  if (!envoi.ok) console.error("Envoi Brevo refusé", envoi.status, await envoi.text());

  // Copie pour Koko : encadré de suivi (qui, scores, réponses), puis le mail tel que reçu.
  const copie = await fetch(`${BREVO}/smtp/email`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      sender: EXPEDITEUR,
      replyTo: prenom ? { email, name: prenom } : { email },
      to: [{ email: EXPEDITEUR.email }],
      subject: `Drivers : ${prenom || email} · ${resultat.titre} (${scoresTexte(resultat.scores)})`,
      htmlContent: avecEncadre(html, { prenom, email, reponses, envoye: envoi.ok, raison, ...resultat }),
      tags: ["drivers-copie"],
    }),
  });
  if (!copie.ok) console.error("Copie Brevo refusée", copie.status, await copie.text());

  if (!envoi.ok) return json({ envoye: false, raison, ...resultat }, 200);
  return json({ envoye: true, ...resultat }, 200);
};

// Scores sur 12 par driver, driver(s) dominant(s), ou profil discret.
function calcule(reponses) {
  const scores = { parfait: 0, plaisir: 0, fort: 0 };
  reponses.forEach((r, i) => { scores[AFFIRMATIONS[i][0]] += r; });
  const max = Math.max(...ORDRE.map((k) => scores[k]));
  const discrets = max <= SEUIL_DISCRET;
  const dominants = discrets ? [] : ORDRE.filter((k) => scores[k] === max);
  const titre = discrets ? DISCRETS.nom : dominants.map((k) => DRIVERS[k].nom).join(" et ");
  return {
    scores, discrets, dominants, titre,
    fiches: dominants.map((k) => ({ cle: k, ...DRIVERS[k] })),
    discret: discrets ? DISCRETS : null,
  };
}

function scoresTexte(s) {
  return `Parfait ${s.parfait} · Plaisir ${s.plaisir} · Fort ${s.fort}`;
}

function niveau(n) {
  return n <= SEUIL_DISCRET ? "discret" : n <= 8 ? "présent" : "très présent";
}

function json(objet, status) {
  return new Response(JSON.stringify(objet), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function echappe(texte) {
  return String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Mail aux couleurs de la charte, polices de secours (les polices web ne chargent pas dans les messageries).
function mail({ prenom, scores, discrets, fiches, titre }) {
  const serif = "Georgia,'Times New Roman',serif";
  const sans = "Arial,Helvetica,sans-serif";
  const mono = "'Courier New',monospace";
  const etiquette = (t, couleur = "#0F766E") => `<p style="margin:0 0 6px;font-family:${mono};font-size:12px;letter-spacing:.1em;color:${couleur};font-weight:bold">${t}</p>`;

  const barres = ORDRE.map((k) => {
    const n = scores[k];
    const pct = Math.round((n / 12) * 100);
    return `<tr>
      <td style="padding:5px 10px 5px 0;font-family:${sans};font-size:14px;color:#002060;white-space:nowrap">${DRIVERS[k].emoji} ${echappe(DRIVERS[k].nom)}</td>
      <td style="padding:5px 0;width:100%"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="background:#C6A016;height:10px;width:${pct}%;font-size:0;line-height:0;border-radius:5px 0 0 5px">&nbsp;</td>
        <td style="background:#E8E4DA;height:10px;font-size:0;line-height:0">&nbsp;</td></tr></table></td>
      <td style="padding:5px 0 5px 10px;font-family:${mono};font-size:12px;color:#5B6474;white-space:nowrap">${n}/12 · ${niveau(n)}</td></tr>`;
  }).join("");

  const fiche = (f) => `
    <div style="border-top:2px solid #C6A016;padding-top:18px;margin:0 0 26px">
      <p style="margin:0 0 14px;font-family:${serif};font-size:24px;color:#002060">${f.emoji} ${echappe(f.nom)}</p>
      ${etiquette("LE MESSAGE INTÉRIEUR")}<p style="margin:0 0 14px">${echappe(f.message)}</p>
      ${etiquette("LA QUESTION CACHÉE")}<p style="margin:0 0 14px">${echappe(f.cachee)}</p>
      ${etiquette("TA FORCE")}<p style="margin:0 0 14px">${echappe(f.force)}</p>
      ${etiquette("QUAND IL EN FAIT TROP")}<p style="margin:0 0 14px">${echappe(f.trop)}</p>
      ${etiquette("COMMENT LE REPÉRER")}<p style="margin:0 0 18px">${echappe(f.reperer)}</p>
      <div style="background:#F2EFE8;border-left:3px solid #C6A016;padding:14px 18px;margin:0 0 18px">
        ${etiquette("TA PERMISSION", "#8A6D0B")}
        <p style="margin:0;font-family:${serif};font-style:italic;font-size:18px;color:#002060">${echappe(f.permission)}</p>
      </div>
      <div style="background:#002060;border-radius:6px;padding:18px 20px;margin:0 0 18px">
        <p style="margin:0 0 8px;font-family:${mono};font-size:12px;letter-spacing:.1em;color:#C6A016;font-weight:bold">★ TON QUICK WIN DE LA SEMAINE</p>
        <p style="margin:0;color:#F2EFE8">${echappe(f.quickWin)}</p>
      </div>
      ${etiquette("DEUX AUTRES PISTES")}
      <ul style="margin:0 0 18px;padding-left:20px">${f.pistes.map((p) => `<li style="margin:0 0 6px">${echappe(p)}</li>`).join("")}</ul>
      <div style="background:#F2EFE8;border-left:3px solid #A0563C;padding:14px 18px">
        ${etiquette("TA QUESTION", "#A0563C")}
        <p style="margin:0;font-family:${serif};font-style:italic;font-size:17px;color:#002060">${echappe(f.question)}</p>
      </div>
    </div>`;

  const blocDiscret = `
    <div style="border-top:2px solid #C6A016;padding-top:18px;margin:0 0 26px">
      <p style="margin:0 0 14px;font-family:${serif};font-size:24px;color:#002060">${DISCRETS.emoji} ${echappe(DISCRETS.nom)}</p>
      ${etiquette("CE QUE ÇA VEUT DIRE")}<p style="margin:0 0 14px">${echappe(DISCRETS.texte)}</p>
      ${etiquette("À OBSERVER")}<p style="margin:0 0 18px">${echappe(DISCRETS.observer)}</p>
      <div style="background:#F2EFE8;border-left:3px solid #A0563C;padding:14px 18px">
        ${etiquette("TA QUESTION", "#A0563C")}
        <p style="margin:0;font-family:${serif};font-style:italic;font-size:17px;color:#002060">${echappe(DISCRETS.question)}</p>
      </div>
    </div>`;

  const intro = discrets
    ? "Voici ton résultat : aucun driver ne domine chez toi. Voici ce que ça veut dire, et quoi observer."
    : fiches.length > 1
      ? "Deux drivers arrivent à égalité chez toi. Voici ce que chacun te dit, ce qu'il t'apporte, et de quoi avancer dès cette semaine."
      : "Voici ce que ton driver dominant te dit, ce qu'il t'apporte, et de quoi avancer dès cette semaine.";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F2EFE8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EFE8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:8px;overflow:hidden">
  <tr><td style="background:#002060;padding:28px 30px">
    <p style="margin:0 0 10px;font-family:${mono};font-size:12px;letter-spacing:.1em;color:#C6A016">MINI-TEST · TES DRIVERS</p>
    <p style="margin:0;font-family:${serif};font-size:26px;line-height:1.2;color:#FFFFFF">${echappe(titre)}</p>
  </td></tr>
  <tr><td style="padding:28px 30px;font-family:${sans};font-size:15px;line-height:1.6;color:#1D2433">
    <p style="margin:0 0 16px">Bonjour${prenom ? " " + echappe(prenom) : ""},</p>
    <p style="margin:0 0 22px">Merci d'avoir pris ces deux minutes pour toi. ${intro}</p>

    ${etiquette("TES TROIS SCORES")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px">${barres}</table>

    ${discrets ? blocDiscret : fiches.map(fiche).join("")}

    <p style="margin:0 0 24px">Samedi, tu recevras ma newsletter : un concept, une idée utilisable, une astuce applicable dès lundi. Et chaque 3ᵉ jeudi du mois, une invitation à mon live, où tu peux venir sans parler ni allumer ta caméra.</p>

    <p style="margin:0 0 12px">Avec gratitude,</p>
    <p style="margin:0;font-family:${serif};font-size:17px;color:#002060">Koko</p>
    <p style="margin:2px 0 0;font-family:${mono};font-size:12px;letter-spacing:.08em;color:#8A6D0B">JE MODÉLISE LA CONFIANCE_</p>
  </td></tr>
  <tr><td style="background:#F2EFE8;padding:14px 30px;font-family:${sans};font-size:12px;line-height:1.5;color:#5B6474">
    Outil d'auto-observation inspiré des drivers de Taibi Kahler et des styles de travail de Julie Hay. Ce n'est pas un test scientifique.<br>
    Tu reçois ce mail parce que tu as demandé ton résultat sur kokolawson.com/drivers. Chaque newsletter contient un lien de désabonnement.<br>Koko Lawson Adoté · <a href="${SITE}" style="color:#5B6474">kokolawson.com</a> · <a href="${SITE}/mentions-legales/#confidentialite" style="color:#5B6474">Confidentialité</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// Ajoute en tête du mail l'encadré de suivi destiné à Koko.
function avecEncadre(html, { prenom, email, reponses, envoye, raison, scores, titre }) {
  const sans = "Arial,Helvetica,sans-serif";
  const mono = "'Courier New',monospace";
  const quand = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" });
  const ligne = (etiquette, valeur) => `<tr><td valign="top" style="padding:4px 12px 4px 0;font-family:${mono};font-size:12px;letter-spacing:.06em;color:#5B6474;white-space:nowrap">${etiquette}</td><td style="padding:4px 0;font-family:${sans};font-size:15px;color:#1D2433">${valeur}</td></tr>`;
  const detail = `<ol style="margin:0;padding-left:20px">${AFFIRMATIONS.map(([k, t], i) => `<li style="margin:0 0 4px">${echappe(t)} <b>${REPONSES[reponses[i]]}</b> <span style="color:#5B6474">(${DRIVERS[k].nom})</span></li>`).join("")}</ol>`;
  const statut = envoye ? "Envoyé" : `<b style="color:#A0563C">Non parti (${echappe(raison)})</b>`;

  const encadre = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:2px solid #C6A016;border-radius:8px">
  <tr><td style="padding:20px 24px">
    <p style="margin:0 0 12px;font-family:${mono};font-size:12px;letter-spacing:.1em;color:#8A6D0B;font-weight:bold">COPIE · NOUVEAU MINI-TEST DRIVERS · ${echappe(quand)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${ligne("PRÉNOM", echappe(prenom || "non renseigné"))}
      ${ligne("ADRESSE", echappe(email))}
      ${ligne("RÉSULTAT", echappe(titre))}
      ${ligne("SCORES", echappe(scoresTexte(scores)))}
      ${ligne("RÉPONSES", detail)}
      ${ligne("MAIL", statut)}
    </table>
    <p style="margin:12px 0 0;font-family:${sans};font-size:13px;color:#5B6474">Répondre à ce mail écrit directement à ${echappe(prenom || email)}. Le mail reçu suit, tel quel.</p>
  </td></tr>
</table>
</td></tr></table>`;

  return html.replace(/(<body[^>]*>)/, `$1${encadre}`);
}
