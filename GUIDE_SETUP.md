# ╔══════════════════════════════════════════════════════════════╗
# ║   MATLOUB — GUIDE INSTALLATION COMPLET                      ║
# ║   Système d'activation automatique BaridiMob → WhatsApp     ║
# ╚══════════════════════════════════════════════════════════════╝

Temps total : environ 30 minutes
Coût total  : 0 DA / 0 €

════════════════════════════════════════════════════════════
ÉTAPE 1 — CallMeBot WhatsApp (10 minutes)
════════════════════════════════════════════════════════════

CallMeBot = service GRATUIT qui envoie des WhatsApp automatiques
Sans compte Business, sans carte bancaire.

1. Ouvre WhatsApp sur ton téléphone
2. Ajoute ce numéro dans tes contacts :
   +34 644 65 21 64  (nom : CallMeBot)
3. Envoie ce message EXACTEMENT :
   "I allow callmebot to send me messages"
4. Tu vas recevoir une réponse avec ta clé API :
   "API Activated for your phone number. Your APIKEY is XXXXXX"
5. Note cette clé → c'est ton CALLMEBOT_APIKEY

⚠️  Si le numéro change : https://www.callmebot.com/blog/free-api-whatsapp-messages/

════════════════════════════════════════════════════════════
ÉTAPE 2 — Firebase Functions (15 minutes)
════════════════════════════════════════════════════════════

2.1 — Installer Node.js (si pas encore fait)
     https://nodejs.org → télécharger version LTS

2.2 — Ouvrir le terminal (cmd ou PowerShell sur Windows)
     et taper ces commandes une par une :

     npm install -g firebase-tools
     firebase login
     (ça ouvre un navigateur → connecte-toi avec ton compte Google matloub)

2.3 — Aller dans le dossier firebase-functions :
     cd matloub-auto/firebase-functions

2.4 — Modifier index.js avec tes vraies valeurs :
     Ligne ADMIN_WHATSAPP  → ton numéro (ex: "213550123456")
     Ligne CALLMEBOT_APIKEY → la clé reçue à l'étape 1
     Ligne adminKey (ligne ~115) → ton mot de passe secret admin

2.5 — Initialiser et déployer :
     npm install firebase-functions firebase-admin
     firebase use matloub-7914f
     firebase deploy --only functions

2.6 — Vérifier que c'est en ligne :
     Tu verras dans le terminal :
     ✔ functions[smsBaridimob]: Successful create operation.
     URL: https://us-central1-matloub-7914f.cloudfunctions.net/smsBaridimob

     → Copie cette URL, tu en auras besoin à l'étape 3

════════════════════════════════════════════════════════════
ÉTAPE 3 — MacroDroid Android (5 minutes)
════════════════════════════════════════════════════════════

3.1 — Installe MacroDroid sur le téléphone qui reçoit les SMS BaridiMob
     (peut être ton téléphone principal)
     https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid

3.2 — Créer la macro :
     → "+" Nouvelle macro
     → Nom : "MATLOUB BaridiMob"

3.3 — DÉCLENCHEUR :
     → Ajouter déclencheur
     → "SMS/MMS reçu"
     → Contenu du SMS contient : "BaridiMob"
     → Valider

3.4 — ACTION :
     → Ajouter action
     → "Connectivité" → "Requête HTTP"
     → URL : https://us-central1-matloub-7914f.cloudfunctions.net/smsBaridimob
     → Méthode : POST
     → Type contenu : application/json
     → Corps :
       {"sms": "{sms_body}"}
       (Attention : utilise la variable magique {sms_body})
     → Valider

3.5 — Activer la macro (toggle ON)

3.6 — Optimisation batterie :
     → Paramètres Android → Applications → MacroDroid
     → Batterie → "Sans restriction"
     (pour que MacroDroid marche même en veille)

════════════════════════════════════════════════════════════
ÉTAPE 4 — Test du système complet
════════════════════════════════════════════════════════════

Test 1 — Simuler un SMS BaridiMob :
  Demande à quelqu'un de t'envoyer un SMS contenant :
  "BaridiMob : Vous avez recu 1000 DA de 0550112233"

  → MacroDroid doit se déclencher
  → Firebase reçoit le SMS
  → WhatsApp envoyé automatiquement au 0550112233

Test 2 — Tester l'activation du code :
  → Ouvre matloub.com
  → Connecte-toi comme pro test
  → Abonnement → entre le code reçu
  → Doit s'activer immédiatement ✅

════════════════════════════════════════════════════════════
RÉSUMÉ — Ce qui se passe automatiquement
════════════════════════════════════════════════════════════

Pro fait un virement BaridiMob de 1000 DA
         ↓ (quelques secondes / minutes)
BaridiMob envoie un SMS sur ton téléphone
         ↓ (instantané)
MacroDroid détecte "BaridiMob" dans le SMS
         ↓ (1 seconde)
Firebase reçoit le SMS et extrait montant + numéro
         ↓ (2 secondes)
Firebase génère code unique MATLOUB-XXXX
         ↓ (1 seconde)
WhatsApp envoyé automatiquement au pro
         ↓
Pro entre le code sur matloub.com → ACTIVÉ ✅
         ↓
TOI tu reçois une notification WhatsApp de confirmation

Délai total : celui du SMS BaridiMob uniquement
Intervention manuelle : AUCUNE ✅
Coût : 0 DA ✅

════════════════════════════════════════════════════════════
CAS PARTICULIERS GÉRÉS AUTOMATIQUEMENT
════════════════════════════════════════════════════════════

✅ Montant correct (1000 DA)  → code envoyé au pro
⚠️  Montant insuffisant        → alerte WhatsApp vers toi (admin)
⚠️  Numéro non détecté         → alerte WhatsApp vers toi (admin)
🔄 Pro redemande son code      → même code renvoyé (pas de doublon)
🛡️  Sécurité                   → code à usage unique dans Firebase

════════════════════════════════════════════════════════════
PANEL ADMIN (backup manuel)
════════════════════════════════════════════════════════════

Si un cas nécessite une action manuelle :
→ Dans MATLOUB admin → nouveau bouton "Générer Code Manuel"
→ Entre le numéro WhatsApp du pro
→ Le code est généré et envoyé automatiquement

(voir le fichier index.html mis à jour)
