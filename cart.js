/* ===========================================================
   Studio Web Local — cart.js
   Panier global : bouton + pastille dans le menu, tiroir latéral
   ouvrable/fermable, persistance localStorage entre les pages.
   =========================================================== */
(function(){
"use strict";

/* ---------- Config ---------- */
var STORAGE_KEY = "swl_cart_v1";
var EMAILJS_PUBLIC = "_Y9wyDROWTwY1--zW";
var SERVICE_ID = "service_a53gjwo";
var TEMPLATE_ADMIN = "template_qw8k1jc";
var TEMPLATE_CLIENT = "template_ec8v56a";
var NAMES = {"550":"Site Vitrine","1115":"Site Premium","2500":"Ultra Premium","129":"Community Management","89":"Abonnement SEO","349":"Pack Ads géré","690":"Refonte express","49":"Pack Avis clients"};
var STRUCTURAL = ["550","1115","2500","690"];

/* ---------- État ---------- */
var cart = [];
try{ var raw = localStorage.getItem(STORAGE_KEY); if(raw) cart = JSON.parse(raw) || []; }catch(e){ cart = []; }
if(!Array.isArray(cart)) cart = [];

function save(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); }catch(e){} }

/* ---------- Styles ---------- */
var CSS = ''
+ '.nav-cart{position:relative;display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;flex:none;margin-left:6px;background:rgba(255,213,74,.08);border:1px solid rgba(255,213,74,.38);border-radius:50%;color:var(--gold,#ffd54a);cursor:pointer;transition:background .25s ease,transform .25s ease,box-shadow .25s ease}'
+ '.nav-cart:hover{background:var(--gold,#ffd54a);color:#1a1305;transform:translateY(-1px);box-shadow:0 8px 22px rgba(255,213,74,.28)}'
+ '.nav-cart svg{width:19px;height:19px;display:block}'
+ '.nav-cart__badge{position:absolute;top:-5px;right:-5px;min-width:21px;height:21px;padding:0 5px;display:none;align-items:center;justify-content:center;background:#ff4d6d;color:#fff;font-family:var(--font-mono,monospace);font-size:11px;font-weight:700;line-height:1;border-radius:999px;border:2px solid var(--bg,#05050f);box-shadow:0 0 0 3px rgba(255,77,109,.22)}'
+ '.nav-cart.has-items .nav-cart__badge{display:flex}'
+ '.nav-cart.has-items{background:rgba(255,213,74,.16);box-shadow:0 0 0 3px rgba(255,213,74,.10)}'
+ '.nav-cart.bump{animation:swlBump .55s cubic-bezier(.34,1.56,.64,1)}'
+ '@keyframes swlBump{0%{transform:scale(1)}35%{transform:scale(1.28)}100%{transform:scale(1)}}'
+ '.swl-overlay{position:fixed;inset:0;background:rgba(3,3,10,.66);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .3s ease;z-index:9000}'
+ '.swl-overlay.open{opacity:1;pointer-events:auto}'
+ '.swl-drawer{position:fixed;top:0;right:0;height:100%;width:min(430px,100%);background:var(--bg-card,#0b0b1d);border-left:1px solid var(--violet-border,rgba(124,107,255,.28));box-shadow:-24px 0 60px rgba(0,0,0,.5);transform:translateX(102%);transition:transform .35s cubic-bezier(.4,0,.2,1);z-index:9100;display:flex;flex-direction:column;font-family:var(--font-body,Inter,sans-serif);color:var(--text,#eaeaf4)}'
+ '.swl-drawer.open{transform:translateX(0)}'
+ '.swl-drawer__hd{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px 16px;border-bottom:1px solid rgba(255,255,255,.08);flex:none}'
+ '.swl-drawer__title{font-family:var(--font-head,Space Grotesk,sans-serif);font-weight:700;font-size:1.08rem;margin:0}'
+ '.swl-drawer__title span{color:var(--gold,#ffd54a);font-family:var(--font-mono,monospace);font-size:.8rem;margin-left:6px}'
+ '.swl-drawer__close{background:none;border:1px solid rgba(255,255,255,.14);color:var(--muted,#8888aa);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:.95rem;line-height:1;transition:all .2s}'
+ '.swl-drawer__close:hover{border-color:#ff6b6b;color:#ff6b6b}'
+ '.swl-drawer__body{flex:1;overflow-y:auto;padding:18px 22px 26px}'
+ '.swl-empty{text-align:center;color:var(--muted,#8888aa);font-size:.9rem;padding:48px 10px}'
+ '.swl-empty a{color:var(--gold,#ffd54a)}'
+ '.swl-drawer .fh:first-child{margin-top:6px}'
+ '.swl-cart-note{font-size:.76rem;color:var(--muted,#8888aa);margin:-2px 0 14px}'
+ '@media(max-width:900px){.nav-cart{margin-left:auto;margin-right:8px}}'
+ '.cart-plan-switch{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}'
+ '.cps-btn{font-family:var(--font-mono,monospace);font-size:.66rem;padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.14);background:transparent;color:var(--muted,#8888aa);cursor:pointer;transition:all .2s}'
+ '.cps-btn:hover{border-color:var(--violet-border,rgba(124,107,255,.28));color:var(--text,#eaeaf4)}'
+ '.cps-btn.active{background:var(--violet-glow,rgba(124,107,255,.14));border-color:var(--violet,#7c6bff);color:var(--text,#eaeaf4);font-weight:600}'
+ '.swl-drawer .fg2{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
;

/* ---------- Markup ---------- */
var CART_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.2l2.3 12.1a1.6 1.6 0 0 0 1.6 1.3h8.5a1.6 1.6 0 0 0 1.6-1.3L21 7H6"/></svg>';

var DRAWER_HTML = ''
+ '<div class="swl-drawer__hd">'
+   '<p class="swl-drawer__title">Votre panier<span id="swlCount"></span></p>'
+   '<button type="button" class="swl-drawer__close" id="swlCloseBtn" aria-label="Fermer le panier">✕</button>'
+ '</div>'
+ '<div class="swl-drawer__body">'
+   '<div id="swlEmpty" class="swl-empty">Votre panier est vide.<br><br>Choisissez une offre dans <a href="offres.html">nos offres</a> ou sur la page <a href="devis.html">devis</a>, puis cliquez sur « Ajouter au panier ».</div>'
+   '<div id="swlContent" style="display:none">'
+     '<div id="cartList"></div>'
+     '<div class="total-bar" id="total"><span class="total-lbl">Aujourd\'hui</span><span class="total-amt">0€</span></div>'
+     '<div id="cartMonthlyNote" class="maintenance-note"><span id="cartMonthlyTxt"></span></div>'
+     '<div id="cartCommitNote" class="maintenance-note" style="border-color:rgba(255,107,107,.28);background:rgba(255,107,107,.06)"><span id="cartCommitTxt"></span></div>'
+     '<p class="fh">Vos coordonnées</p>'
+     '<div class="fg2"><div class="fg"><input id="prenom" class="fi" placeholder="Prénom" aria-label="Prénom"></div><div class="fg"><input id="nom" class="fi" placeholder="Nom" aria-label="Nom"></div></div>'
+     '<div class="fg2"><div class="fg"><input id="email" class="fi" placeholder="Email" aria-label="Email"></div><div class="fg"><input id="telephone" class="fi" placeholder="Téléphone" aria-label="Téléphone"></div></div>'
+     '<div class="fg"><input id="entreprise" class="fi" placeholder="Nom de l\'entreprise" aria-label="Nom de l\'entreprise"></div>'
+     '<div class="fg"><input id="secteur" class="fi" placeholder="Secteur d\'activité" aria-label="Secteur d\'activité"></div>'
+     '<div class="fg"><textarea id="description" class="ft" placeholder="Un mot sur votre projet (optionnel)" aria-label="Un mot sur votre projet"></textarea></div>'
+     '<div class="quote-actions">'
+       '<button id="emailBtn" class="btn btn--ghost" style="flex:1;justify-content:center;padding:15px;font-size:.88rem">Recevoir par email</button>'
+       '<button id="payBtn" class="btn btn--gold" style="flex:1;justify-content:center;padding:15px;font-size:.88rem">Payer maintenant</button>'
+     '</div>'
+     '<div id="quote-status"></div>'
+   '</div>'
+ '</div>';

/* ---------- Injection ---------- */
var btnEl, badgeEl, drawerEl, overlayEl, ready = false;

function inject(){
  if(ready) return;
  var navInner = document.querySelector(".main-nav__inner");
  if(!navInner) return;

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  btnEl = document.createElement("button");
  btnEl.type = "button";
  btnEl.className = "nav-cart";
  btnEl.id = "navCartBtn";
  btnEl.setAttribute("aria-label", "Ouvrir le panier");
  btnEl.innerHTML = CART_ICON + '<span class="nav-cart__badge" id="navCartBadge">0</span>';
  var burger = navInner.querySelector(".main-nav__burger");
  if(burger) navInner.insertBefore(btnEl, burger); else navInner.appendChild(btnEl);
  badgeEl = btnEl.querySelector("#navCartBadge");
  btnEl.addEventListener("click", function(){ toggleCart(); });

  overlayEl = document.createElement("div");
  overlayEl.className = "swl-overlay";
  overlayEl.id = "swlOverlay";
  overlayEl.addEventListener("click", closeCart);
  document.body.appendChild(overlayEl);

  drawerEl = document.createElement("aside");
  drawerEl.className = "swl-drawer";
  drawerEl.id = "swlDrawer";
  drawerEl.setAttribute("aria-hidden", "true");
  drawerEl.innerHTML = DRAWER_HTML;
  document.body.appendChild(drawerEl);

  drawerEl.querySelector("#swlCloseBtn").addEventListener("click", closeCart);
  drawerEl.querySelector("#emailBtn").addEventListener("click", function(){ sendQuote("email"); });
  drawerEl.querySelector("#payBtn").addEventListener("click", function(){ sendQuote("pay"); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") closeCart(); });

  ready = true;
  renderCart();
}

/* ---------- Ouverture / fermeture ---------- */
function openCart(){
  if(!ready) inject();
  if(!drawerEl) return;
  drawerEl.classList.add("open");
  overlayEl.classList.add("open");
  drawerEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
}
function closeCart(){
  if(!drawerEl) return;
  drawerEl.classList.remove("open");
  overlayEl.classList.remove("open");
  drawerEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}
function toggleCart(){
  if(drawerEl && drawerEl.classList.contains("open")) closeCart(); else openCart();
}

/* ---------- Calculs ---------- */
var DEPOSIT_RATE = 0.4;

/* Décompose une ligne "site" selon le mode de paiement choisi :
   once      -> tout aujourd'hui
   deposit   -> 40% aujourd'hui, le solde à la livraison
   deposit3x -> 40% aujourd'hui, le solde en 3 mensualités sans frais */
function planParts(item){
  var amount = Number(item.amount) || 0;
  if(item.plan === "deposit" || item.plan === "deposit3x"){
    var today = Math.round(amount * DEPOSIT_RATE);
    var balance = amount - today;
    var n = item.plan === "deposit3x" ? 3 : 1;
    return {today: today, balance: balance, installments: n, perInstallment: Math.round(balance / n)};
  }
  return {today: amount, balance: 0, installments: 0, perInstallment: 0};
}

function cartTotals(){
  var upfront = 0, monthly = 0, balance = 0;
  cart.forEach(function(item){
    if(item.type === "structural"){
      var p = planParts(item);
      upfront += p.today;
      balance += p.balance;
      if(item.maintenanceMonthly > 0){ upfront += item.maintenanceMonthly; monthly += item.maintenanceMonthly; }
    }else{
      upfront += item.amount; monthly += item.amount;
    }
  });
  return {upfront: upfront, monthly: monthly, balance: balance};
}

/* ---------- Ajout / retrait ---------- */
function addToCart(auto, forcedPlan){
  var sel = document.getElementById("service");
  var service = sel ? sel.value : "";
  if(!service){ if(!auto) alert("Choisis une offre à ajouter"); return; }
  var name = NAMES[service] || "";
  var isStructural = STRUCTURAL.indexOf(service) !== -1;
  var plan = forcedPlan || window._selectedPlan || "once";
  var amount = window._currentPreviewTotal || parseInt(service, 10) || 0;
  var maint = window._currentMaintenanceMonthly || 0;
  var opts = (typeof window.getSelectedOptions === "function") ? window.getSelectedOptions() : "";

  if(isStructural){
    var already = null;
    cart.forEach(function(c){ if(c.type === "structural") already = c; });
    if(already){
      if(!auto && !confirm('Vous avez déjà "' + already.name + '" dans votre panier. Le remplacer par "' + name + '" ?')) return;
      cart = cart.filter(function(c){ return c.type !== "structural"; });
    }
    cart.push({type:"structural", service:service, name:name, amount:amount, maintenanceMonthly:maint, plan:plan, options:opts});
  }else{
    var dup = cart.some(function(c){ return c.service === service; });
    if(dup){ if(!auto) alert('"' + name + '" est déjà dans votre panier.'); return; }
    cart.push({type:"subscription", service:service, name:name, amount:amount});
  }
  save();
  if(sel) sel.value = "";
  if(typeof window.setBase === "function") window.setBase();
  renderCart();
  bump();
  openCart();
}
function removeFromCart(idx){ cart.splice(idx, 1); save(); renderCart(); }
function clearCart(){ cart = []; save(); renderCart(); }
function setCartItemPlan(idx, plan){
  if(!cart[idx] || cart[idx].type !== "structural") return;
  cart[idx].plan = plan; save(); renderCart();
}
/* Appelé depuis le questionnaire : pré-sélectionne l'offre + ses options,
   puis l'ajoute au panier avec le mode de paiement choisi. */
function quizAddToCart(serviceCode, optionSelectors, plan){
  var sel = document.getElementById("service");
  if(!sel) return;
  sel.value = serviceCode;
  if(typeof window.setBase === "function") window.setBase();
  (optionSelectors || []).forEach(function(o){
    var el = null;
    if(o.sel) el = document.querySelector("#options " + o.sel);
    else if(o.idx !== undefined) el = document.querySelectorAll('#options input[type="checkbox"]')[o.idx];
    if(el){ el.checked = true; if(typeof window.calcPreview === "function") window.calcPreview(); }
  });
  addToCart(true, plan);
}

function bump(){
  if(!btnEl) return;
  btnEl.classList.remove("bump");
  void btnEl.offsetWidth;
  btnEl.classList.add("bump");
}

/* ---------- Rendu ---------- */
function renderCart(){
  if(!ready) return;
  var count = cart.length;
  if(badgeEl) badgeEl.textContent = count;
  if(btnEl) btnEl.classList.toggle("has-items", count > 0);
  var countLbl = document.getElementById("swlCount");
  if(countLbl) countLbl.textContent = count > 0 ? "(" + count + ")" : "";

  var emptyEl = document.getElementById("swlEmpty");
  var contentEl = document.getElementById("swlContent");
  var list = document.getElementById("cartList");
  if(!list) return;
  if(count === 0){
    if(emptyEl) emptyEl.style.display = "block";
    if(contentEl) contentEl.style.display = "none";
    list.innerHTML = "";
    return;
  }
  if(emptyEl) emptyEl.style.display = "none";
  if(contentEl) contentEl.style.display = "block";

  list.innerHTML = cart.map(function(item, i){
    var priceTxt, planZone;
    if(item.type === "structural"){
      var pp = planParts(item);
      priceTxt = item.plan === "once"
        ? item.amount + "€"
        : pp.today + "€ <span style=\'font-size:.68rem;color:var(--muted,#8888aa);font-weight:400\'>aujourd\'hui</span>";
      planZone = '<div class="cart-plan-switch">'
        + '<button type="button" class="cps-btn' + (item.plan === "once" ? " active" : "") + '" data-plan="once" data-idx="' + i + '">Comptant</button>'
        + '<button type="button" class="cps-btn' + (item.plan === "deposit" ? " active" : "") + '" data-plan="deposit" data-idx="' + i + '">Acompte 40 %</button>'
        + '<button type="button" class="cps-btn' + (item.plan === "deposit3x" ? " active" : "") + '" data-plan="deposit3x" data-idx="' + i + '">Acompte + 3 fois</button>'
        + '</div>';
      if(item.maintenanceMonthly > 0) planZone += '<span class="cart-item-plan">Maintenance ' + item.maintenanceMonthly + '€/mois incluse, résiliable à tout moment</span>';
      if(item.plan === "deposit") planZone += '<span class="cart-item-plan">Puis ' + pp.balance + '€ à la livraison du site</span>';
      if(item.plan === "deposit3x") planZone += '<span class="cart-item-plan">Puis 3 × ' + pp.perInstallment + '€, une fois le site livré</span>';
    }else{
      priceTxt = item.amount + "€/mois";
      planZone = '<span class="cart-item-plan">Abonnement mensuel — prix fixe</span>';
    }
    return '<div class="cart-item"><div class="cart-item-info"><span class="cart-item-name">' + item.name + '</span>' + planZone + '</div>'
      + '<div class="cart-item-price">' + priceTxt + '</div>'
      + '<button type="button" class="cart-item-remove" data-remove="' + i + '" aria-label="Retirer ' + item.name + ' du panier">✕</button></div>';
  }).join("");

  list.querySelectorAll(".cps-btn").forEach(function(b){
    b.addEventListener("click", function(){ setCartItemPlan(parseInt(b.dataset.idx, 10), b.dataset.plan); });
  });
  list.querySelectorAll("[data-remove]").forEach(function(b){
    b.addEventListener("click", function(){ removeFromCart(parseInt(b.dataset.remove, 10)); });
  });

  var t = cartTotals();
  var totalEl = document.querySelector("#total .total-amt");
  if(totalEl) totalEl.textContent = t.upfront + "€";

  var noteEl = document.getElementById("cartMonthlyNote"), txtEl = document.getElementById("cartMonthlyTxt");
  if(noteEl && txtEl){
    if(t.monthly > 0){ noteEl.style.display = "flex"; txtEl.textContent = "Puis " + t.monthly + "€ chaque mois, tant que vous ne résiliez pas vos abonnements."; }
    else noteEl.style.display = "none";
  }
  var deferred = null;
  cart.forEach(function(c){ if(c.type === "structural" && c.plan !== "once") deferred = c; });
  var commitEl = document.getElementById("cartCommitNote"), commitTxt = document.getElementById("cartCommitTxt");
  if(commitEl && commitTxt){
    if(deferred){
      var d = planParts(deferred);
      commitTxt.textContent = deferred.plan === "deposit3x"
        ? "Vous réglez aujourd'hui l'acompte de " + d.today + "€ (40 %). Le solde de " + d.balance + "€ est ensuite réparti en 3 mensualités de " + d.perInstallment + "€, prélevées après la livraison du site. Sans frais."
        : "Vous réglez aujourd'hui l'acompte de " + d.today + "€ (40 %). Le solde de " + d.balance + "€ est réglé à la livraison du site, avant la remise des accès.";
      commitEl.style.display = "flex";
    }else commitEl.style.display = "none";
  }
}

/* ---------- Envoi du devis / paiement ---------- */
function get(id){ var el = document.getElementById(id); return el ? el.value : ""; }
function setStatus(msg, type){
  var el = document.getElementById("quote-status");
  if(!el) return;
  el.textContent = msg; el.className = type || "loading";
}
function lockBtn(l){
  ["emailBtn","payBtn"].forEach(function(id){
    var b = document.getElementById(id);
    if(b){ b.disabled = l; b.style.opacity = l ? .55 : 1; }
  });
}
async function incrementOrder(){
  if(typeof window.incrementOrder === "function" && window.incrementOrder !== incrementOrder){ try{ await window.incrementOrder(); return; }catch(e){} }
  try{ await fetch("/.netlify/functions/order-counter", {method:"POST"}); }catch(e){}
}

async function sendQuote(mode){
  if(cart.length === 0){ alert("Ajoutez au moins une offre à votre panier"); return; }
  var email = get("email");
  if(!email){ alert("L'email est obligatoire"); var ee = document.getElementById("email"); if(ee) ee.focus(); return; }
  var structural = cart.filter(function(c){ return c.type === "structural"; })[0] || null;
  var subscriptions = cart.filter(function(c){ return c.type === "subscription"; });
  var t = cartTotals();
  var cartSummary = cart.map(function(c){
    if(c.type === "structural"){
      var q = planParts(c);
      if(c.plan === "once") return c.name + " (" + c.amount + "€ comptant)";
      if(c.plan === "deposit") return c.name + " (" + c.amount + "€ : acompte " + q.today + "€ puis " + q.balance + "€ à la livraison)";
      return c.name + " (" + c.amount + "€ : acompte " + q.today + "€ puis 3 × " + q.perInstallment + "€)";
    }
    return c.name + " (" + c.amount + "€/mois)";
  }).join(" + ");
  var planLabels = {once:"Comptant (1x)", deposit:"Acompte 40 % puis solde à la livraison", deposit3x:"Acompte 40 % puis solde en 3 fois sans frais"};
  var data = {
    service_name: cartSummary,
    service: structural ? structural.service : (subscriptions[0] ? subscriptions[0].service : ""),
    total: t.upfront + "€",
    options: subscriptions.map(function(s){return s.name}).join(", ") || (structural ? structural.options : ""),
    payment_link: "",
    payment_plan: structural ? structural.plan : "once",
    payment_plan_label: structural ? planLabels[structural.plan] : "Abonnement mensuel",
    maintenance_monthly: t.monthly,
    cart_summary: cartSummary,
    deposit_amount: structural ? planParts(structural).today + "€" : "—",
    balance_amount: structural && structural.plan !== "once" ? planParts(structural).balance + "€" : "—",
    balance_schedule: structural && structural.plan === "deposit3x" ? "3 × " + planParts(structural).perInstallment + "€" : (structural && structural.plan === "deposit" ? "En une fois à la livraison" : "—"),
    total_today: t.upfront + "€",
    total_monthly: t.monthly > 0 ? t.monthly + "€/mois" : "—",
    prenom: get("prenom"), nom: get("nom"), email: email, telephone: get("telephone"),
    entreprise: get("entreprise"), secteur: get("secteur"),
    message: get("message"), description: get("description")
  };
  lockBtn(true);
  setStatus(mode === "pay" ? "Préparation du paiement Stripe…" : "Génération du devis…", "loading");
  try{
    var payload = {
      structural: structural ? {amount: structural.amount, service_name: structural.name, payment_plan: structural.plan} : null,
      maintenance_monthly: structural ? (structural.maintenanceMonthly || 0) : 0,
      subscriptions: subscriptions.map(function(s){ return {amount: s.amount, service_name: s.name}; })
    };
    var res = await fetch("/.netlify/functions/create-payment", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(payload)});
    var json = await res.json();
    if(!res.ok || !json.url) throw new Error(json.error || ("Erreur serveur " + res.status));
    data.payment_link = json.url;
  }catch(err){
    console.error("Netlify:", err); lockBtn(false);
    setStatus("Erreur : " + err.message, "error"); return;
  }
  try{
    await incrementOrder();
    setStatus("Lien créé, envoi de la confirmation en cours…", "ok");
    if(window.emailjs){
      try{ emailjs.init(EMAILJS_PUBLIC); }catch(e){}
      var jobs = [emailjs.send(SERVICE_ID, TEMPLATE_ADMIN, data)];
      if(mode !== "pay") jobs.push(emailjs.send(SERVICE_ID, TEMPLATE_CLIENT, data));
      await Promise.all(jobs);
    }
    clearCart();
    if(mode === "pay"){ window.location.href = data.payment_link; return; }
    closeCart();
    document.body.classList.remove("no-scroll");
    document.body.innerHTML = '<div style="text-align:center;margin-top:18%;color:#eaeaf4;font-family:\'Space Grotesk\',sans-serif;padding:0 20px;"><h1 style="color:#ffd54a;font-size:2.6rem;margin-bottom:12px;">Devis envoyé</h1><p style="color:#8888aa;margin-bottom:32px;">Merci ! Vous allez recevoir votre devis par email, avec le lien de paiement inclus. Nous reviendrons vers vous très prochainement.</p><button onclick="location.href=\'index.html\'" style="background:#ffd54a;padding:14px 32px;border:none;cursor:pointer;font-weight:700;border-radius:10px;font-size:1rem;font-family:\'Space Grotesk\',sans-serif;">Retour</button></div>';
  }catch(err){
    console.error("EmailJS:", err); lockBtn(false);
    setStatus("Erreur envoi email", "error");
  }
}

/* ---------- API globale ---------- */
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.setCartItemPlan = setCartItemPlan;
window.quizAddToCart = quizAddToCart;
window.sendQuote = sendQuote;
window.openCart = openCart;
window.closeCart = closeCart;
window.toggleCart = toggleCart;
window.renderCart = renderCart;
window.cartTotals = cartTotals;
window.swlCart = cart;

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
else inject();

})();