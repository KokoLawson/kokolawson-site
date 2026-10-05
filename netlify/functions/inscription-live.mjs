// Relais Tally -> Brevo pour les inscriptions au live mensuel.
// Tally appelle cette fonction à chaque inscription (webhook). Elle :
//   1. vérifie la signature Tally, pour que personne d'autre ne puisse déclencher d'envoi ;
//   2. ajoute ou met à jour le contact dans Brevo (liste 3 « Communauté Koko »,
//      plus la liste 4 « Newsletter Koko » si le consentement est « Oui ») ;
//   3. envoie le mail de confirmation à partir du modèle Brevo.
// Le contenu du mail (date, lien Meet, texte) se modifie dans Brevo, sans redéployer le site.
//
// Variables d'environnement à régler dans Netlify (Site configuration > Environment variables) :
//   BREVO_API_KEY          clé API Brevo
//   TALLY_SIGNING_SECRET   secret de signature affiché dans Tally (Integrations > Webhooks)
//   BREVO_TEMPLATE_ID      facultatif, numéro du modèle Brevo à envoyer (par défaut ci-dessous)

import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";

const MODELE_PAR_DEFAUT = 25; // « Live 22 octobre 2026 - confirmation d'inscription »
const LISTE_LIVE = 3;
const LISTE_NEWSLETTER = 4;
const BREVO = "https://api.brevo.com/v3";

export const config = { path: "/api/inscription-live" };

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

  // Le champ « Mail » peut être un bloc Email ou un simple texte court selon le formulaire.
  const email = [
    champs.find((c) => c.type === "INPUT_EMAIL"),
    champs.find((c) => /mail/i.test(c.label || "")),
  ].map(valeurTexte).find((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
  const prenom = valeurTexte(champs.find((c) => /pr[ée]nom/i.test(c.label || "")));
  const consentement = choixRetenus(champs.find((c) => /consentement/i.test(c.label || "")));
  const newsletter = consentement.some((t) => /^oui/i.test(t));

  // 200 et non 400 : une adresse mal saisie ne doit pas faire réessayer Tally en boucle.
  if (!email) {
    console.error("Inscription sans adresse mail valide");
    return new Response("Email manquant ou invalide", { status: 200 });
  }

  const entetes = { "api-key": cleBrevo, "content-type": "application/json", accept: "application/json" };

  // Le contact : un échec ici n'empêche pas l'envoi du mail, la réponse reste dans Tally.
  const contact = await fetch(`${BREVO}/contacts`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      email,
      attributes: prenom ? { PRENOM: prenom } : {},
      listIds: newsletter ? [LISTE_LIVE, LISTE_NEWSLETTER] : [LISTE_LIVE],
      updateEnabled: true,
    }),
  });
  if (!contact.ok) console.error("Contact Brevo refusé", contact.status, await contact.text());

  const envoi = await fetch(`${BREVO}/smtp/email`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({
      templateId: Number(process.env.BREVO_TEMPLATE_ID) || MODELE_PAR_DEFAUT,
      to: [prenom ? { email, name: prenom } : { email }],
      params: { PRENOM: prenom },
    }),
  });
  if (!envoi.ok) {
    // Un statut d'erreur fait réessayer Tally plus tard.
    console.error("Envoi Brevo refusé", envoi.status, await envoi.text());
    return new Response("Envoi refusé", { status: 502 });
  }

  return new Response("OK", { status: 200 });
};

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
  if (typeof champ?.value === "boolean") return champ.value ? ["Oui"] : [];
  if (!champ || !Array.isArray(champ.value)) return [];
  const options = champ.options || [];
  return champ.value.map((id) => options.find((o) => o.id === id)?.text || String(id));
}
