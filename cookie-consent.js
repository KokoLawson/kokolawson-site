// ============================================
// Cookie consent + Google Analytics — kokolawson.com
// Fichier unique partagé par toutes les pages du site.
// Pour modifier le texte, les couleurs ou l'ID GA : éditer ce fichier uniquement.
// ============================================

(function () {
  var GA_ID = 'G-6LL5YFC43R';

  // Injecte le HTML du bandeau
  function injecterBandeau() {
    var div = document.createElement('div');
    div.id = 'cookie-banner';
    div.style.cssText = 'display:none; position:fixed; bottom:0; left:0; right:0; z-index:9999; background:#002060; border-top:2px solid #c6a016; padding:20px 5%; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap;';
    div.innerHTML =
      '<p style="font-size:14px; color:rgba(255,255,255,0.85); line-height:1.6; margin:0; max-width:700px; font-family:\'Hanken Grotesk\',system-ui,sans-serif;">' +
        'Ce site utilise Google Analytics pour mesurer l\'audience et améliorer le contenu. Tes données sont anonymisées. ' +
        '<a href="/mentions-legales/#cookies" style="color:#c6a016; text-decoration:underline;">En savoir plus</a>' +
      '</p>' +
      '<div style="display:flex; gap:12px; flex-shrink:0;">' +
        '<button id="cookie-refuser" style="background:transparent; border:1px solid rgba(255,255,255,0.3); color:rgba(255,255,255,0.7); padding:10px 20px; font-size:13px; cursor:pointer; font-family:\'Hanken Grotesk\',system-ui,sans-serif;">Refuser</button>' +
        '<button id="cookie-accepter" style="background:#c6a016; border:none; color:#002060; padding:10px 24px; font-size:13px; font-weight:700; cursor:pointer; font-family:\'Hanken Grotesk\',system-ui,sans-serif;">Accepter</button>' +
      '</div>';
    document.body.appendChild(div);

    document.getElementById('cookie-accepter').addEventListener('click', accepterCookies);
    document.getElementById('cookie-refuser').addEventListener('click', refuserCookies);
  }

  function accepterCookies() {
    localStorage.setItem('cookie_consent', 'accepted');
    document.getElementById('cookie-banner').style.display = 'none';
    chargerGA();
  }

  function refuserCookies() {
    localStorage.setItem('cookie_consent', 'refused');
    document.getElementById('cookie-banner').style.display = 'none';
  }

  function chargerGA() {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function init() {
    injecterBandeau();
    var consent = localStorage.getItem('cookie_consent');
    if (consent === 'accepted') {
      chargerGA();
    } else if (consent === 'refused') {
      // Ne rien faire
    } else {
      document.getElementById('cookie-banner').style.display = 'flex';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
