# APK Socline

APK Android de Socline, généré depuis le shell Capacitor (`android/`).
L'application est un **shell natif** (splash orange, icône SC) qui charge
`https://socline.oquitogo.com` — aucun contenu web n'est embarqué, la version
affichée suit donc automatiquement le site (aucun rebuild à chaque évolution).

## Téléchargement

Fichier servi statiquement par Next.js :

```
/apk/socline-v1.1-debug.apk   (≈ 11 Mo, build debug signé clé debug)
```

> Le binaire `.apk` est volontairement dans `.gitignore` mais **forcé au
> commit** (`git add -f public/apk/socline-v1.1-debug.apk`) afin que le
> déploiement le serve automatiquement.

### Journal des versions

- **v1.1** (versionCode 2) : Capacitor 8.3.1 — l'app est désormais **limitée
  aux zones sûres** entre la barre de statut et la barre de navigation
  (insets Android injectés en CSS par le plugin `SystemBars`, complément du
  blindage web `max(env(), var(--safe-area-inset-*))`). Corrige la
  superposition du contenu sous les barres système sur Android 15+.
- v1.0 (versionCode 1) : shell initial (splash orange, icône SC, chargement
  de la plateforme).

Installation sur un téléphone Android : ouvrir le fichier → autoriser
« Installer depuis des sources inconnues » → installer.

## Regénérer l'APK

Prérequis : JDK 17+ **complet** (avec `javac`), Android SDK (platform 36,
build-tools 36.0.0), licences acceptées.

```bash
cd android
export JAVA_HOME=/chemin/vers/jdk          # doit contenir bin/javac
export ANDROID_HOME=/chemin/vers/android-sdk
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

> Environnements de dev : `local.properties` (sdk.dir) est ignoré par Git,
> le créer localement si le SDK n'est pas détecté automatiquement.

## Version release (diffusion / Play Store)

Le build debug est destiné aux **tests**. Pour une diffusion large, produire
un APK release signé avec une keystore dédiée (`keytool` + `signingConfigs`
dans `android/app/build.gradle`, keystore JAMAIS committée).
