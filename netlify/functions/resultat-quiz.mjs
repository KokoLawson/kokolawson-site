// Analyse complète de l'auto-diagnostic, envoyée par mail.
// La page /quiz/ affiche tout de suite le nom du profil et le score, puis appelle
// cette fonction avec le prénom, l'adresse et les situations cochées. Elle :
//   1. recalcule le profil à partir des situations (le texte du mail ne vient jamais du navigateur) ;
//   2. ajoute le contact aux listes Brevo 3 et 4, seulement si la case de consentement est cochée ;
//   3. envoie l'analyse complète par mail ;
//   4. renvoie l'analyse à la page, qui l'affiche aussi.
//
// Variable d'environnement Netlify : BREVO_API_KEY (déjà utilisée par inscription-live).
// Les seuils et les noms de profils sont repris dans /quiz/index.html : les garder identiques.

import process from "node:process";

const LISTE_LIVE = 3;
const LISTE_NEWSLETTER = 4;
const BREVO = "https://api.brevo.com/v3";
const SITE = "https://kokolawson.com";
const EXPEDITEUR = { name: "Koko Lawson Adoté", email: "contact@kokolawson.com" };

// Dans le même ordre que les cases de /quiz/.
const SITUATIONS = [
  "En réunion, je prépare deux fois plus que les autres, et j'interviens deux fois moins.",
  "Il m'est arrivé de voir mon idée reformulée par quelqu'un d'autre… et applaudie.",
  "Je relis mes emails importants plus de trois fois avant d'envoyer.",
  "Je me dis souvent : « je le dirai si on me le demande ».",
  "J'ai déjà renoncé à demander une augmentation ou une promotion que je méritais.",
  "On m'a déjà dit « tu manques de leadership » ou « tu dois gagner en impact ».",
  "Je rumine mes interventions des heures (ou des jours) après.",
  "Je me sens plus légitime à valoriser le travail des autres que le mien.",
  "À la maison je rayonne ; au bureau je me contiens.",
  "J'attends d'être sûr·e à 100 % avant de parler, donc souvent, je ne parle pas.",
  "Quand on me félicite, je pense « ils surestiment » ou « c'était facile ».",
  "Je rentre parfois épuisé·e, pas par le travail, par l'énergie passée à me contenir.",
];

const PROFILS = [
  { max: 3,
    nom: "Vigie ponctuelle",
    texte: "Ton invisibilité est situationnelle : elle se déclenche dans des contextes précis, pas en permanence. C'est le profil le plus rapide à faire bouger.",
    parcours: "Focus",
    detail: "5 séances · 900 €",
    pourquoi: "Parce qu'il s'agit de dénouer des situations identifiables, pas de déloger un fonctionnement de fond. Un objectif défini dès la première séance, un résultat observable à la dernière." },
  { max: 7,
    nom: "Expert·e en retrait",
    texte: "Le mécanisme est installé : tu compenses par l'excellence ce que tu n'oses pas encore occuper en présence. Ce n'est plus une situation, c'est un fonctionnement qui se répète.",
    parcours: "Maîtrise",
    detail: "8 séances · 1 400 €",
    pourquoi: "Parce qu'un fonctionnement installé ne se dénoue pas en cinq séances. On cartographie le mécanisme en profondeur, puis on installe la posture et on l'ancre." },
  { max: 12,
    nom: "Invisibilité structurelle",
    texte: "Tu fonctionnes probablement en sur-adaptation permanente : un coût en énergie, en euros et en trajectoire. Ce n'est pas un trait de personnalité, c'est une posture apprise, donc désapprenable.",
    parcours: "Prends ta place",
    detail: "12 séances + 4 ateliers · 2 300 €",
    pourquoi: "Parce qu'à ce niveau, ce n'est pas un comportement à corriger mais une posture à reconstruire : présence, affirmation, valorisation de soi, sens et direction." },
];

export const config = { path: "/api/resultat-quiz" };

export default async (req) => {
  if (req.method !== "POST") return json({ erreur: "Méthode non autorisée" }, 405);

  // Seule la page du site peut appeler la fonction (domaine principal ou aperçus Netlify).
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

  // Champ piège invisible : un robot le remplit, une personne non.
  if (donnees.site) return json({ envoye: false }, 200);

  const email = String(donnees.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return json({ erreur: "Adresse mail invalide" }, 400);
  }
  const prenom = String(donnees.prenom || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
  const coches = [...new Set((Array.isArray(donnees.coches) ? donnees.coches : [])
    .map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < SITUATIONS.length))].sort((a, b) => a - b);
  const consentement = donnees.consentement === true;

  const score = coches.length;
  const profil = PROFILS.find((p) => score <= p.max);
  const situations = coches.map((i) => SITUATIONS[i]);
  const analyse = { score, profil, situations };

  const cleBrevo = process.env.BREVO_API_KEY;
  if (!cleBrevo) {
    console.error("Configuration incomplète : BREVO_API_KEY absent");
    return json({ envoye: false, ...analyse }, 200);
  }
  const entetes = { "api-key": cleBrevo, "content-type": "application/json", accept: "application/json" };

  // Le contact n'entre dans les listes qu'avec le consentement explicite.
  if (consentement) {
    const contact = await fetch(`${BREVO}/contacts`, {
      method: "POST",
      headers: entetes,
      body: JSON.stringify({
        email,
        attributes: prenom ? { PRENOM: prenom } : {},
        listIds: [LISTE_LIVE, LISTE_NEWSLETTER],
        updateEnabled: true,
      }),
    });
    if (!contact.ok) console.error("Contact Brevo refusé", contact.status, await contact.text());
  }

  const envoi = await fetch(`${BREVO}/smtp/email`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      sender: EXPEDITEUR,
      replyTo: { email: EXPEDITEUR.email },
      to: [prenom ? { email, name: prenom } : { email }],
      subject: `Ton profil d'invisibilité : ${profil.nom}`,
      htmlContent: mail({ prenom, consentement, ...analyse }),
      tags: ["quiz"],
    }),
  });
  if (!envoi.ok) console.error("Envoi Brevo refusé", envoi.status, await envoi.text());

  return json({ envoye: envoi.ok, ...analyse }, 200);
};

function json(objet, status) {
  return new Response(JSON.stringify(objet), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function echappe(texte) {
  return String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Mail aux couleurs de la charte. Polices de secours (Georgia, Arial, Courier New) :
// les polices web ne chargent pas dans les messageries.
function mail({ prenom, consentement, score, profil, situations }) {
  const serif = "Georgia,'Times New Roman',serif";
  const sans = "Arial,Helvetica,sans-serif";
  const mono = "'Courier New',monospace";
  const etiquette = (t) => `<p style="margin:0 0 6px;font-family:${mono};font-size:12px;letter-spacing:.1em;color:#0F766E">${t}</p>`;
  const bouton = (href, t) => `<a href="${href}" style="display:inline-block;background:#C6A016;color:#001640;font-family:${sans};font-weight:bold;font-size:15px;text-decoration:none;padding:12px 22px;border-radius:4px">${t}</a>`;

  const liste = situations.length
    ? `<ul style="margin:0;padding-left:20px">${situations.map((s) => `<li style="margin:0 0 8px">${echappe(s)}</li>`).join("")}</ul>`
    : `<p style="margin:0">Tu n'as coché aucune situation.</p>`;

  const piedConsentement = consentement
    ? "Tu recevras aussi la newsletter du samedi et l'invitation au live mensuel. Chaque mail contient un lien de désabonnement."
    : "Tu reçois ce mail parce que tu as demandé ton analyse sur kokolawson.com/quiz. Aucun autre mail ne te sera envoyé sans ton accord.";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F2EFE8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EFE8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:8px;overflow:hidden">
  <tr><td style="background:#002060;padding:28px 30px">
    <p style="margin:0 0 10px;font-family:${mono};font-size:12px;letter-spacing:.1em;color:#C6A016">AUTO-DIAGNOSTIC · TON PROFIL · ${score}/12</p>
    <p style="margin:0;font-family:${serif};font-size:28px;line-height:1.2;color:#FFFFFF">${echappe(profil.nom)}</p>
  </td></tr>
  <tr><td style="padding:28px 30px;font-family:${sans};font-size:15px;line-height:1.6;color:#1D2433">
    <p style="margin:0 0 16px">Bonjour${prenom ? " " + echappe(prenom) : ""},</p>
    <p style="margin:0 0 24px">Voici ton analyse complète. Prends-la comme une photo de ce qui se joue aujourd'hui, pas comme un verdict.</p>

    ${etiquette("CE QUE TON PROFIL DIT DE TOI")}
    <p style="margin:0 0 24px">${echappe(profil.texte)}</p>

    ${etiquette("LES SITUATIONS QUE TU AS COCHÉES")}
    <div style="margin:0 0 24px">${liste}</div>

    <div style="border-top:2px solid #C6A016;padding-top:14px;margin:0 0 24px">
      ${etiquette("LE PARCOURS QUI Y RÉPOND")}
      <p style="margin:0 0 8px;font-family:${serif};font-size:20px;color:#002060">${echappe(profil.parcours)} · ${echappe(profil.detail)}</p>
      <p style="margin:0 0 16px;color:#5B6474">${echappe(profil.pourquoi)}</p>
      ${bouton(`${SITE}/accompagnement/`, `Découvrir ${echappe(profil.parcours)}`)}
    </div>

    <div style="background:#F2EFE8;border-left:3px solid #A0563C;padding:16px 18px;margin:0 0 24px">
      <p style="margin:0 0 8px;font-family:${mono};font-size:12px;letter-spacing:.1em;color:#A0563C;font-weight:bold">À TON RYTHME</p>
      <p style="margin:0 0 8px"><b>Le live mensuel</b>, chaque 3ᵉ jeudi de 20h à 21h. Tu poses tes questions, ou tu écoutes seulement : tu peux venir sans parler ni allumer ta caméra. <a href="${SITE}/live/" style="color:#0F766E">Voir le live</a></p>
      <p style="margin:0"><b>La Séance Découverte</b>, 45 minutes offertes pour comprendre ce qui se joue pour toi. <a href="${SITE}/seance-decouverte/" style="color:#0F766E">Choisir un créneau</a></p>
    </div>

    <p style="margin:0;font-family:${serif};font-size:17px;color:#002060">Koko</p>
    <p style="margin:2px 0 0;font-family:${mono};font-size:12px;letter-spacing:.08em;color:#8A6D0B">JE MODÉLISE LA CONFIANCE_</p>
  </td></tr>
  <tr><td style="background:#F2EFE8;padding:14px 30px;font-family:${sans};font-size:12px;line-height:1.5;color:#5B6474">
    ${piedConsentement}<br>Koko Lawson Adoté · <a href="${SITE}" style="color:#5B6474">kokolawson.com</a> · <a href="${SITE}/mentions-legales/#confidentialite" style="color:#5B6474">Confidentialité</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
