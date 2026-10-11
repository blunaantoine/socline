# APK Socline

APK Android de Socline, généré depuis le shell Capacitor (`android/`).
L'application est un **shell natif** (splash orange, icône SC) qui charge
`https://socline.oquitogo.com` — aucun contenu web n'est embarqué, la version
affichée suit donc automatiquement le site (aucun rebuild à chaque évolution).

## Téléchargement

Fichier servi statiquement par Next.js :

```
/apk/socline-v1.0-debug.apk   (≈ 11 Mo, build debug signé clé debug)
```

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
