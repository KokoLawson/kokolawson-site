// Analyse complète de l'auto-diagnostic, envoyée par mail.
// La page /quiz/ affiche tout de suite le nom du profil et le score, puis appelle
// cette fonction avec le prénom, l'adresse et les situations cochées. Elle :
//   1. recalcule le profil à partir des situations (le texte du mail ne vient jamais du navigateur) ;
//   2. ajoute le contact aux listes Brevo 3 et 4 (la page annonce la newsletter sous le bouton),
//      avec son profil, son score, ses situations et la date du quiz (champs QUIZ_*) ;
//   3. envoie l'analyse par mail : quick win, astuces et questions propres au profil, sans parler des offres ;
//   4. renvoie l'analyse à la page, qui ne l'affiche en entier que si le mail n'a pas pu partir.
//
// Variable d'environnement Netlify : BREVO_API_KEY (aussi utilisée par inscription-live).
// Les seuils et les noms de profils sont repris dans /quiz/index.html : les garder identiques.
// Contrôle sans envoi : GET /api/resultat-quiz indique si la clé est présente et acceptée par Brevo.

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
    texte: "Ton invisibilité est situationnelle : elle se déclenche dans des contextes précis, pas en permanence. Ailleurs, tu sais déjà prendre ta place. Le travail consiste à repérer où et quand le mécanisme s'active, pour reprendre la main à ces moments-là.",
    quickWin: { titre: "Repère ton déclencheur",
      texte: "Cette semaine, après chaque réunion, note dans un carnet : à quel moment tu n'as rien dit, devant qui, et ce que tu aurais voulu dire. En quelques jours, un schéma apparaît : une personne, un type de réunion, un sujet. C'est là que tout se joue." },
    astuces: [
      { titre: "Prépare une phrase, pas une présentation.", texte: "Avant la réunion qui te déclenche, écris la phrase que tu veux dire. Une seule. Et dis-la dans les dix premières minutes : plus tu attends, plus elle pèse." },
      { titre: "Parle une fois en premier.", texte: "Ouvrir la discussion, même par une question, installe ta présence pour toute la suite de la réunion." },
      { titre: "Remplace « je pense que peut-être » par « je propose ».", texte: "Les précautions oratoires diluent une idée solide. Garde le fond, enlève les excuses." },
    ],
    questions: [
      "Dans quelles situations est-ce que je prends ma place sans même y penser ? Qu'est-ce qui est différent là-bas ?",
      "Qu'est-ce que je me raconte, juste avant de me taire ?",
      "La prochaine fois, si je prenais la parole, quel serait le pire qui puisse arriver ? Et le meilleur ?",
    ] },
  { max: 7,
    nom: "Expert·e en retrait",
    texte: "Le mécanisme est installé : tu compenses par l'excellence ce que tu n'oses pas encore occuper en présence. Tu prépares, tu vérifies, tu livres un travail impeccable, et tu laisses ce travail parler pour toi. Le problème, c'est qu'il parle rarement assez fort.",
    quickWin: { titre: "Dis « j'ai » au lieu de « on a »",
      texte: "Cette semaine, une fois, en réunion ou dans un mail, attribue-toi ce que tu as fait : « j'ai analysé », « j'ai proposé », « j'ai résolu ». Une seule fois suffit. Puis observe ce qui se passe, chez les autres et en toi." },
    astuces: [
      { titre: "Tiens ton journal des réussites.", texte: "Chaque vendredi, trois lignes : ce que tu as fait, ce que ça a permis, qui l'a vu. Dans trois mois, tu sauras parler de toi sans improviser." },
      { titre: "Fixe une limite à ta préparation.", texte: "Décide à l'avance du temps que tu y consacres. Au-delà, tu ne prépares plus : tu te protèges." },
      { titre: "Partage tes résultats avant qu'on te les demande.", texte: "Quand un dossier aboutit, deux lignes à ton N+1 suffisent : ce qui est fait, et ce que ça change." },
    ],
    questions: [
      "Qu'est-ce que je crois devoir prouver avant d'avoir le droit de prendre la parole ?",
      "Qui, autour de moi, connaît vraiment la valeur de mon travail ? Et qui devrait la connaître ?",
      "Si mon travail ne parlait plus pour moi, qu'est-ce que j'aurais envie de dire ?",
    ] },
  { max: 12,
    nom: "Invisibilité structurelle",
    texte: "Tu fonctionnes probablement en sur-adaptation permanente : tu observes, tu ajustes, tu te contiens, presque tout le temps. Ça coûte de l'énergie, souvent plus que le travail lui-même. Ce n'est pas un trait de personnalité, c'est une posture apprise. Et ce qui s'apprend peut se désapprendre.",
    quickWin: { titre: "Mesure ton énergie, pas tes tâches",
      texte: "Cinq soirs de suite, en rentrant, note de 1 à 10 ton niveau d'énergie, et le moment de la journée où tu t'es le plus retenu·e. Ce n'est pas une tâche de plus : c'est la carte de ce qui t'épuise vraiment." },
    astuces: [
      { titre: "Choisis un seul espace pour commencer.", texte: "Une réunion, un groupe, une personne où tu t'autorises à être la même personne qu'à la maison. Un seul, pas tout à la fois." },
      { titre: "Nomme l'émotion avant de la ranger.", texte: "Quand quelque chose monte, dis-le-toi : « je suis agacé·e », « je doute ». Nommer une émotion suffit souvent à la faire redescendre." },
      { titre: "Garde un sas entre le bureau et la maison.", texte: "Cinq minutes dans la voiture, le métro ou devant ta porte pour déposer la journée avant de retrouver les tiens." },
    ],
    questions: [
      "À quel moment de ma vie ai-je appris qu'il valait mieux me contenir ? Est-ce encore vrai aujourd'hui ?",
      "Qui suis-je quand je ne m'adapte pas ? Où cette version de moi existe-t-elle déjà ?",
      "De quoi aurais-je besoin pour être un peu plus moi au travail, dès la semaine prochaine ?",
    ] },
];

export const config = { path: "/api/resultat-quiz" };

export default async (req) => {
  const cleBrevo = process.env.BREVO_API_KEY;

  // Contrôle de configuration, sans envoi ni donnée de compte renvoyée.
  if (req.method === "GET") {
    if (!cleBrevo) return json({ cle: false }, 200);
    const compte = await fetch(`${BREVO}/account`, { headers: { "api-key": cleBrevo, accept: "application/json" } });
    const detail = compte.ok ? "" : (await compte.text()).slice(0, 300);
    return json({ cle: true, brevo: compte.status, detail }, 200);
  }
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

  // Anti-robot : un envoi moins d'une seconde après l'affichage du formulaire n'est pas humain.
  // Pas de champ piège caché : la saisie automatique des navigateurs et des gestionnaires de
  // mots de passe le remplissait, et de vraies visiteuses étaient prises pour des robots.
  const tropRapide = !(Number(donnees.delai) >= 1000);

  const email = String(donnees.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return json({ erreur: "Adresse mail invalide" }, 400);
  }
  const prenom = String(donnees.prenom || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60);
  const coches = [...new Set((Array.isArray(donnees.coches) ? donnees.coches : [])
    .map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < SITUATIONS.length))].sort((a, b) => a - b);

  const score = coches.length;
  const profil = PROFILS.find((p) => score <= p.max);
  const situations = coches.map((i) => SITUATIONS[i]);
  const analyse = { score, profil, situations };

  // Envoi trop rapide : rien n'est envoyé ni enregistré, mais l'analyse revient à la page,
  // pour qu'une personne très rapide prise pour un robot la lise quand même.
  if (tropRapide) return json({ envoye: false, raison: "rapide", ...analyse }, 200);

  if (!cleBrevo) {
    console.error("Configuration incomplète : BREVO_API_KEY absent");
    return json({ envoye: false, raison: "cle", ...analyse }, 200);
  }
  const entetes = { "api-key": cleBrevo, "content-type": "application/json", accept: "application/json" };

  const contact = await fetch(`${BREVO}/contacts`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      email,
      // Champs QUIZ_* créés dans Brevo le 7 octobre 2026. Situations : numéros des cases cochées,
      // de 1 à 12 dans l'ordre de la page (voir SITUATIONS). Un nouveau quiz écrase le précédent.
      attributes: {
        ...(prenom ? { PRENOM: prenom } : {}),
        QUIZ_PROFIL: profil.nom,
        QUIZ_SCORE: score,
        QUIZ_SITUATIONS: coches.map((i) => i + 1).join(", "),
        QUIZ_DATE: new Date().toISOString().slice(0, 10),
      },
      listIds: [LISTE_LIVE, LISTE_NEWSLETTER],
      updateEnabled: true,
    }),
  });
  if (!contact.ok) console.error("Contact Brevo refusé", contact.status, await contact.text());

  const envoi = await fetch(`${BREVO}/smtp/email`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      sender: EXPEDITEUR,
      replyTo: { email: EXPEDITEUR.email },
      to: [prenom ? { email, name: prenom } : { email }],
      subject: `Ton profil d'invisibilité : ${profil.nom}`,
      htmlContent: mail({ prenom, ...analyse }),
      tags: ["quiz"],
    }),
  });
  if (!envoi.ok) {
    const detail = await envoi.text();
    console.error("Envoi Brevo refusé", envoi.status, detail);
    return json({ envoye: false, raison: `brevo ${envoi.status}`, ...analyse }, 200);
  }

  return json({ envoye: true, ...analyse }, 200);
};

function json(objet, status) {
  return new Response(JSON.stringify(objet), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}

function echappe(texte) {
  return String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Mail aux couleurs de la charte. Polices de secours (Georgia, Arial, Courier New) :
// les polices web ne chargent pas dans les messageries.
function mail({ prenom, score, profil, situations }) {
  const serif = "Georgia,'Times New Roman',serif";
  const sans = "Arial,Helvetica,sans-serif";
  const mono = "'Courier New',monospace";
  const etiquette = (t, couleur = "#0F766E") => `<p style="margin:0 0 8px;font-family:${mono};font-size:12px;letter-spacing:.1em;color:${couleur};font-weight:bold">${t}</p>`;

  const liste = situations.length
    ? `<ul style="margin:0;padding-left:20px;color:#5B6474">${situations.map((s) => `<li style="margin:0 0 6px">${echappe(s)}</li>`).join("")}</ul>`
    : `<p style="margin:0;color:#5B6474">Tu n'as coché aucune situation : chez toi, le mécanisme est discret. Ce qui suit t'aide à le repérer le jour où il s'active.</p>`;

  const astuces = profil.astuces.map((a, i) => `
      <tr><td valign="top" style="width:30px;padding:0 0 14px;font-family:${mono};font-size:14px;color:#8A6D0B;font-weight:bold">0${i + 1}</td>
      <td style="padding:0 0 14px"><b style="color:#002060">${echappe(a.titre)}</b> ${echappe(a.texte)}</td></tr>`).join("");

  const questions = profil.questions.map((q) => `<p style="margin:0 0 12px;font-family:${serif};font-style:italic;font-size:17px;line-height:1.45;color:#002060">${echappe(q)}</p>`).join("");

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
    <p style="margin:0 0 24px">Merci d'avoir pris ces deux minutes pour toi. Voici ton analyse, et de quoi avancer dès cette semaine.</p>

    ${etiquette("CE QUE TON PROFIL DIT DE TOI")}
    <p style="margin:0 0 18px">${echappe(profil.texte)}</p>
    ${situations.length ? `<p style="margin:0 0 6px;font-size:14px;color:#5B6474">Les situations que tu as reconnues :</p>` : ""}
    <div style="margin:0 0 28px;font-size:14px">${liste}</div>

    <div style="background:#002060;border-radius:6px;padding:20px 22px;margin:0 0 28px">
      <p style="margin:0 0 8px;font-family:${mono};font-size:12px;letter-spacing:.1em;color:#C6A016;font-weight:bold">TON QUICK WIN DE LA SEMAINE</p>
      <p style="margin:0 0 8px;font-family:${serif};font-size:21px;line-height:1.25;color:#FFFFFF">${echappe(profil.quickWin.titre)}</p>
      <p style="margin:0;color:#F2EFE8">${echappe(profil.quickWin.texte)}</p>
    </div>

    ${etiquette("TROIS ASTUCES POUR ALLER PLUS LOIN")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;font-family:${sans};font-size:15px;line-height:1.6;color:#1D2433">${astuces}</table>

    <div style="background:#F2EFE8;border-left:3px solid #A0563C;padding:18px 20px;margin:0 0 28px">
      ${etiquette("TROIS SÉRIES DE QUESTIONS À TE POSER", "#A0563C")}
      <p style="margin:0 0 14px;font-size:14px;color:#5B6474">Choisis-en une seule, et laisse-la travailler quelques jours. Les réponses viennent souvent quand on ne les cherche plus.</p>
      ${questions}
    </div>

    <p style="margin:0 0 24px">Samedi, tu recevras ma newsletter : un concept, une idée utilisable, une astuce applicable dès lundi. Et chaque 3ᵉ jeudi du mois, une invitation à mon live, où tu peux venir sans parler ni allumer ta caméra.</p>

    <p style="margin:0 0 12px">Avec gratitude,</p>
    <p style="margin:0;font-family:${serif};font-size:17px;color:#002060">Koko</p>
    <p style="margin:2px 0 0;font-family:${mono};font-size:12px;letter-spacing:.08em;color:#8A6D0B">JE MODÉLISE LA CONFIANCE_</p>
  </td></tr>
  <tr><td style="background:#F2EFE8;padding:14px 30px;font-family:${sans};font-size:12px;line-height:1.5;color:#5B6474">
    Tu reçois ce mail parce que tu as demandé ton analyse sur kokolawson.com/quiz. Chaque newsletter contient un lien de désabonnement.<br>Koko Lawson Adoté · <a href="${SITE}" style="color:#5B6474">kokolawson.com</a> · <a href="${SITE}/mentions-legales/#confidentialite" style="color:#5B6474">Confidentialité</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
