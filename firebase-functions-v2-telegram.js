/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║   MATLOUB — Activation automatique v2                   ║
 * ║   BaridiMob SMS → Firebase → Telegram Bot → Pro         ║
 * ║   100% GRATUIT — API Telegram officielle                ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * DÉPLOIEMENT :
 *   npm install -g firebase-tools
 *   firebase login
 *   cd firebase-functions && npm install
 *   firebase use matloub-7914f
 *   firebase deploy --only functions
 */

const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const https     = require("https");
admin.initializeApp();
const db = admin.firestore();

// ─── ⚙️  CONFIG — MODIFIE CES 3 VALEURS UNIQUEMENT ──────────
const CONFIG = {
  // 1. Token du bot Telegram — obtenu via @BotFather (voir GUIDE)
  TELEGRAM_BOT_TOKEN: "VOTRE_TOKEN_BOTFATHER",

  // 2. Ton Telegram Chat ID (pour recevoir les alertes admin)
  //    Obtenir via @userinfobot après avoir démarré ton bot
  ADMIN_CHAT_ID: "VOTRE_CHAT_ID_ADMIN",

  // 3. Montant attendu en DA
  MONTANT: 1000,

  // 4. Préfixe codes
  PREFIX: "MATLOUB",

  // 5. Clé secrète admin — DOIT être identique à ADMIN_KEY dans index.html/admin.html
  ADMIN_KEY: "MATLOUB_ADMIN_SECRET_2026",
};
// ─────────────────────────────────────────────────────────────

/** Génère un code unique ex: MATLOUB-K7P2 */
function genCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)];
  return `${CONFIG.PREFIX}-${s}`;
}

/** Envoie un message Telegram — API officielle, 100% gratuit */
async function telegram(chatId, text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let d = "";
      res.on("data", chunk => d += chunk);
      res.on("end", () => resolve(JSON.parse(d)));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * 📲 ENDPOINT PRINCIPAL
 * Appelé par MacroDroid quand un SMS BaridiMob est reçu
 *
 * POST https://us-central1-matloub-7914f.cloudfunctions.net/smsBaridimob
 * Body : { "sms": "...contenu SMS...", "telPro": "0550XXXXXX" }
 *
 * Note: MacroDroid envoie {sms_body} automatiquement
 * Le numéro du pro est extrait du SMS BaridiMob OU envoyé par MacroDroid
 */
exports.smsBaridimob = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const smsBrut = req.body.sms || "";
  const telManuel = req.body.telPro || ""; // optionnel, si MacroDroid l'extrait
  console.log("📩 SMS BaridiMob reçu:", smsBrut);

  // ── 1. Extraire le montant ──────────────────────────────────
  // Formats BaridiMob typiques:
  // "Vous avez recu un virement de 1000.00 DZD"
  // "Montant: 1000 DA"
  // "1000,00 DA credite"
  const montantMatch = smsBrut.match(/(\d[\d\s.,]*)\s*(?:DA|DZD|Dinars?)/i);
  const montant = montantMatch
    ? parseInt(montantMatch[1].replace(/[\s,.]/g, ""))
    : 0;

  // ── 2. Extraire le numéro de téléphone du pro ──────────────
  // BaridiMob inclut parfois le numéro expéditeur ou le RIB
  // On utilise telManuel si MacroDroid le fournit
  let telPro = telManuel.replace(/\D/g, "");
  if (!telPro) {
    const telMatch = smsBrut.match(/0(5|6|7)\d{8}/);
    if (telMatch) telPro = telMatch[0];
  }
  // Normaliser vers format international
  if (telPro.startsWith("0")) telPro = "213" + telPro.slice(1);
  if (!telPro.startsWith("213") && telPro.length >= 9) telPro = "213" + telPro;

  // ── 3. Vérifier montant ────────────────────────────────────
  if (montant < CONFIG.MONTANT) {
    console.log(`❌ Montant insuffisant: ${montant} DA`);
    await telegram(CONFIG.ADMIN_CHAT_ID,
      `⚠️ *MATLOUB — Virement insuffisant*\n` +
      `💰 Montant reçu: *${montant} DA*\n` +
      `📱 Tel: ${telPro || "Non détecté"}\n` +
      `❌ Code NON généré\n\n` +
      `📋 SMS: \`${smsBrut.slice(0, 150)}\``
    );
    return res.status(200).json({ ok: false, raison: "montant_insuffisant", montant });
  }

  // ── 4. Vérifier si un code existe déjà pour ce numéro ──────
  if (telPro) {
    const existing = await db.collection("activation_codes")
      .where("telPro", "==", telPro)
      .where("used", "==", false)
      .get();

    if (!existing.empty) {
      const oldCode = existing.docs[0].data().code;
      const oldChatId = existing.docs[0].data().telegramChatId;
      console.log(`🔄 Code déjà existant: ${oldCode}`);

      if (oldChatId) {
        await telegram(oldChatId,
          `🔁 *MATLOUB* — Rappel de votre code :\n\n` +
          `🔑 \`${oldCode}\`\n\n` +
          `Entrez ce code sur *matloub.com* → Abonnement`
        );
      }
      await telegram(CONFIG.ADMIN_CHAT_ID,
        `🔄 *Code renvoyé* à ${telPro}: \`${oldCode}\``
      );
      return res.status(200).json({ ok: true, code: oldCode, action: "resent" });
    }
  }

  // ── 5. Générer code unique ─────────────────────────────────
  let code;
  for (let i = 0; i < 10; i++) {
    code = genCode();
    const snap = await db.collection("activation_codes").doc(code).get();
    if (!snap.exists) break;
  }

  // ── 6. Sauvegarder dans Firebase ───────────────────────────
  await db.collection("activation_codes").doc(code).set({
    code,
    telPro: telPro || "inconnu",
    montant,
    source: "payant",
    expiresAt: null,
    smsBrut: smsBrut.slice(0, 300),
    used: false,
    telegramChatId: null, // sera mis à jour quand le pro démarre le bot
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Code généré: ${code} pour tel: ${telPro}`);

  // ── 7. Message au pro ──────────────────────────────────────
  // Si on a le telPro → l'admin peut lui envoyer manuellement
  // Le bot Telegram envoie automatiquement si le pro a démarré /start

  // Notifier l'admin avec le code et le lien WhatsApp de secours
  const lienWA = telPro
    ? `https://wa.me/${telPro}?text=${encodeURIComponent(
        `💎 *MATLOUB* — Votre code d'activation :\n\n*${code}*\n\nEntrez ce code sur matloub.com → Abonnement → Code d'activation\n\n✅ Activation immédiate !`
      )}`
    : null;

  await telegram(CONFIG.ADMIN_CHAT_ID,
    `✅ *MATLOUB — Paiement reçu !*\n\n` +
    `💰 Montant: *${montant} DA*\n` +
    `📱 Tel: ${telPro ? `+${telPro}` : "Non détecté"}\n` +
    `🔑 Code: \`${code}\`\n\n` +
    `${lienWA ? `👉 [Envoyer via WhatsApp](${lienWA})` : "⚠️ Numéro non détecté — envoyez manuellement"}`
  );

  // Chercher si le pro a déjà démarré le bot Telegram
  const proSnap = await db.collection("telegram_users")
    .where("tel", "==", telPro)
    .limit(1)
    .get();

  if (!proSnap.empty) {
    const proChatId = proSnap.docs[0].data().chatId;
    await telegram(proChatId,
      `💎 *MATLOUB* — Activation Pro à Vie\n\n` +
      `Merci pour votre paiement de *${montant} DA* !\n\n` +
      `Votre code d'activation :\n\n` +
      `🔑 \`${code}\`\n\n` +
      `Comment l'utiliser :\n` +
      `1️⃣ Ouvrez *matloub.com*\n` +
      `2️⃣ Connectez-vous à votre compte Pro\n` +
      `3️⃣ Allez dans 💎 *Abonnement*\n` +
      `4️⃣ Entrez le code → *Activer*\n\n` +
      `✅ Activation immédiate garantie !`
    );
    // Mettre à jour le code avec le chatId
    await db.collection("activation_codes").doc(code).update({ telegramChatId: proChatId });
  }

  return res.status(200).json({ ok: true, code, telPro });
});


/**
 * 🤖 BOT TELEGRAM — reçoit les messages des pros
 * Configure le Webhook Telegram vers cette URL après déploiement :
 *
 * https://api.telegram.org/bot{TOKEN}/setWebhook?url=
 *   https://us-central1-matloub-7914f.cloudfunctions.net/telegramWebhook
 */
exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
  const msg = req.body.message;
  if (!msg) return res.sendStatus(200);

  const chatId  = msg.chat.id;
  const text    = (msg.text || "").trim();
  const contact = msg.contact;

  // ── /start : accueil ───────────────────────────────────────
  if (text.startsWith("/start")) {
    await telegram(chatId,
      `👋 Bonjour ! Bienvenue sur le bot *MATLOUB*.\n\n` +
      `Pour recevoir votre code d'activation automatiquement après un virement BaridiMob, ` +
      `partagez votre numéro de téléphone :\n\n` +
      `Appuyez sur le bouton 📱 ci-dessous`
    );

    // Demander le numéro via bouton contact
    const keyboard = JSON.stringify({
      keyboard: [[{ text: "📱 Partager mon numéro", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
    await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        chat_id: chatId,
        text: "Appuyez sur le bouton pour partager votre numéro :",
        reply_markup: keyboard,
      });
      const r = https.request({
        hostname: "api.telegram.org",
        path: `/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      }, res2 => { res2.on("data", () => {}); res2.on("end", resolve); });
      r.on("error", reject);
      r.write(body);
      r.end();
    });
    return res.sendStatus(200);
  }

  // ── Réception du contact (numéro de téléphone) ─────────────
  if (contact) {
    let tel = contact.phone_number.replace(/\D/g, "").replace(/^\+/, "");
    if (tel.startsWith("0")) tel = "213" + tel.slice(1);
    if (!tel.startsWith("213")) tel = "213" + tel;

    // Enregistrer le pro dans Firebase
    await db.collection("telegram_users").doc(String(chatId)).set({
      chatId: String(chatId),
      tel,
      name: contact.first_name + " " + (contact.last_name || ""),
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await telegram(chatId,
      `✅ Numéro enregistré : *+${tel}*\n\n` +
      `Dès que votre virement BaridiMob de *1000 DA* sera détecté, ` +
      `vous recevrez votre code d'activation directement ici.\n\n` +
      `⏳ Délai : quelques minutes après le virement.`
    );

    // Vérifier si un code est déjà en attente pour ce numéro
    const pending = await db.collection("activation_codes")
      .where("telPro", "==", tel)
      .where("used", "==", false)
      .get();

    if (!pending.empty) {
      const code = pending.docs[0].data().code;
      await db.collection("activation_codes").doc(code).update({ telegramChatId: String(chatId) });
      await telegram(chatId,
        `🎉 Un code vous attend déjà !\n\n` +
        `🔑 Votre code : \`${code}\`\n\n` +
        `Entrez-le sur *matloub.com* → Abonnement → Code d'activation`
      );
    }
    return res.sendStatus(200);
  }

  // ── Message inconnu ────────────────────────────────────────
  await telegram(chatId,
    `Envoyez /start pour enregistrer votre numéro et recevoir votre code d'activation.`
  );
  return res.sendStatus(200);
});


/**
 * 🔧 ENDPOINT ADMIN — Génération manuelle de code
 * Utilisé par le panel admin de matloub.com
 *
 * POST /genererCodeManuel
 * Body : { "telPro": "0550112233", "adminKey": "..." }
 */
exports.genererCodeManuel = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST")   return res.status(405).send("Method Not Allowed");

  const { telPro, adminKey, montant, source, validityDays } = req.body;
  if (adminKey !== CONFIG.ADMIN_KEY) return res.status(403).json({ error: "Non autorisé" });

  let tel = (telPro || "").replace(/\D/g, "");
  if (tel) {
    if (tel.startsWith("0")) tel = "213" + tel.slice(1);
    if (!tel.startsWith("213") && tel.length >= 9) tel = "213" + tel;
  }

  const montantFinal = parseInt(montant) || CONFIG.MONTANT;
  const sourceFinal = source || "offert";
  const expiresAt = validityDays ? (Date.now() + parseInt(validityDays) * 86400000) : null;

  let code;
  for (let i = 0; i < 10; i++) {
    code = genCode();
    const snap = await db.collection("activation_codes").doc(code).get();
    if (!snap.exists) break;
  }

  await db.collection("activation_codes").doc(code).set({
    code, telPro: tel || null, montant: montantFinal,
    source: sourceFinal, expiresAt,
    smsBrut: "MANUEL_ADMIN", used: false, telegramChatId: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Chercher si le pro est sur Telegram → envoi automatique
  let sent = false;
  if (tel) {
    const proSnap = await db.collection("telegram_users").where("tel", "==", tel).limit(1).get();
    if (!proSnap.empty) {
      const chatId = proSnap.docs[0].data().chatId;
      await telegram(chatId,
        `💎 *MATLOUB* — Votre code d'activation :\n\n🔑 \`${code}\`\n\nEntrez ce code sur *matloub.com* → Abonnement → Code d'activation`
      );
      await db.collection("activation_codes").doc(code).update({ telegramChatId: chatId });
      sent = true;
    }
  }

  // Notifier l'admin
  await telegram(CONFIG.ADMIN_CHAT_ID,
    `🔧 *Code manuel généré (${sourceFinal})*\n📱 Tel: ${tel ? "+" + tel : "Non fourni"}\n🔑 Code: \`${code}\`\n📤 Telegram: ${sent ? "✅ Envoyé" : "❌ Pro pas sur Telegram"}`
  );

  return res.status(200).json({ ok: true, code, telegramSent: sent });
});
