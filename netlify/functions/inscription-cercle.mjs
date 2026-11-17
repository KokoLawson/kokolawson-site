// Relais Tally -> Brevo pour les inscriptions au Cercle (communauté WhatsApp).
// Tally appelle cette fonction à chaque réponse au formulaire lbplNV (webhook). Elle :
//   1. vérifie la signature Tally, pour que personne d'autre ne puisse déclencher d'envoi ;
//   2. envoie à la personne le mail avec le lien WhatsApp (modèle Brevo n°33) ;
//   3. envoie une copie à contact@kokolawson.com, pour que Koko sache qui arrive.
// Aucun contact n'est ajouté aux listes Brevo : le formulaire ne demande pas de consentement.
// Le texte du mail et le lien WhatsApp se modifient dans Brevo, sans redéployer le site.
//
// Variables d'environnement (les mêmes que pour le live) :
//   BREVO_API_KEY          clé API Brevo
//   TALLY_SIGNING_SECRET   secret de signature saisi dans Tally (Integrations > Webhooks)
//   BREVO_TEMPLATE_CERCLE  facultatif, numéro du modèle Brevo à envoyer (par défaut ci-dessous)

import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";

const MODELE_PAR_DEFAUT = 33; // « Le Cercle - lien WhatsApp après inscription »
const BREVO = "https://api.brevo.com/v3";
const KOKO = { email: "contact@kokolawson.com", name: "Koko" };

export const config = { path: "/api/inscription-cercle" };

export default async (req) => {
  if (req.method !== "POST") return new Response("Méthode non autorisée", { status: 405 });

  const cleBrevo = process.env.BREVO_API_KEY;
  const secretTally = process.env.TALLY_SIGNING_SECRET;
  if (!cleBrevo || !secretTally) {
    console.error("Configuration incomplète : BREVO_API_KEY ou TALLY_SIGNING_SECRET absent");
    return new Response("Configuration incomplète", { status: 500 });
  }

  const corps = await req.text();
  if (!signatureValide(corps, req.headers.get("tally-signature"), secretTally)) {
    return new Response("Signature invalide", { status: 401 });
  }

  let champs;
  try {
    champs = JSON.parse(corps).data.fields;
  } catch {
    return new Response("Contenu illisible", { status: 400 });
  }

  // Le champ « Adresse email » est un texte court dans ce formulaire.
  const email = [
    champs.find((c) => c.type === "INPUT_EMAIL"),
    champs.find((c) => /mail/i.test(c.label || "")),
  ].map(valeurTexte).find((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
  const prenom = valeurTexte(champs.find((c) => /pr[ée]nom/i.test(c.label || "")));
  const motif = choixRetenus(champs.find((c) => /am[eè]ne/i.test(c.label || ""))).join(", ");
  const precision = valeurTexte(champs.find((c) => c.type === "INPUT_TEXT" && !c.label));

  // 200 et non 400 : une adresse mal saisie ne doit pas faire réessayer Tally en boucle.
  if (!email) {
    console.error("Inscription au Cercle sans adresse mail valide");
    return new Response("Email manquant ou invalide", { status: 200 });
  }

  const entetes = { "api-key": cleBrevo, "content-type": "application/json", accept: "application/json" };

  const envoi = await fetch(`${BREVO}/smtp/email`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      templateId: Number(process.env.BREVO_TEMPLATE_CERCLE) || MODELE_PAR_DEFAUT,
      to: [prenom ? { email, name: prenom } : { email }],
      params: { PRENOM: prenom },
      tags: ["cercle"],
    }),
  });
  if (!envoi.ok) {
    // Un statut d'erreur fait réessayer Tally plus tard.
    console.error("Envoi Brevo refusé", envoi.status, await envoi.text());
    return new Response("Envoi refusé", { status: 502 });
  }

  // La copie : un échec ici ne compte pas, la personne a reçu son lien.
  const copie = await fetch(`${BREVO}/smtp/email`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      sender: KOKO,
      to: [KOKO],
      replyTo: prenom ? { email, name: prenom } : { email },
      subject: `Cercle : ${prenom || email} a reçu le lien WhatsApp`,
      htmlContent: copieHtml({ prenom, email, motif, precision }),
      tags: ["cercle-copie"],
    }),
  });
  if (!copie.ok) console.error("Copie Brevo refusée", copie.status, await copie.text());

  return new Response("OK", { status: 200 });
};

function copieHtml({ prenom, email, motif, precision }) {
  const ligne = (titre, valeur) => (valeur ? `<p><b>${titre} :</b> ${echapper(valeur)}</p>` : "");
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nouvelle inscription au Cercle</title></head>
<body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1D2433;">
<p>Une personne vient de demander à rejoindre le Cercle. Elle a reçu le lien WhatsApp par mail.</p>
${ligne("Prénom", prenom)}${ligne("Adresse", email)}${ligne("Ce qui l'amène", motif)}${ligne("Précision", precision)}
<p>Répondre à ce mail lui écrit directement.</p>
</body></html>`;
}

function echapper(texte) {
  return String(texte).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function signatureValide(corps, signature, secret) {
  if (!signature) return false;
  const attendue = Buffer.from(createHmac("sha256", secret).update(corps).digest("base64"));
  const recue = Buffer.from(signature);
  return attendue.length === recue.length && timingSafeEqual(attendue, recue);
}

function valeurTexte(champ) {
  return typeof champ?.value === "string" ? champ.value.trim() : "";
}

// Tally renvoie les identifiants des options cochées, on les traduit en libellés.
function choixRetenus(champ) {
  if (!champ || !Array.isArray(champ.value)) return [];
  const options = champ.options || [];
  return champ.value.map((id) => options.find((o) => o.id === id)?.text || String(id));
}
