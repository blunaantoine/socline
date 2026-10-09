# Prompt – Refonte complète de l'interface (à envoyer à l'agent IA)

## Rôle

Tu es un designer produit senior et un développeur mobile expert. Tu vas refondre **toute l'interface** de mon application mobile de lavage auto (laveurs indépendants et stations) pour lui donner un rendu **professionnel, sobre et moderne**, comparable aux grandes applications de services (Uber, Bolt, Yango, Glovo).

## Règles à ne jamais enfreindre

1. **Garde mon identité visuelle** : le logo, la couleur orange de la marque et ses nuances actuelles. Lis le code existant (thème, fichiers de couleurs, assets) pour retrouver les valeurs exactes. Ne les remplace pas, ne les "améliore" pas.
2. **Ne touche pas à la logique métier** : API, base de données, authentification, navigation entre écrans, état, paiements, noms des routes. Tu changes uniquement l'apparence et la structure visuelle.
3. **Aucune fonctionnalité ne doit disparaître.** Tout ce qui existe aujourd'hui doit rester accessible.
4. **Le texte reste en français**, avec les montants au format actuel (ex. 2 500 F).

## Problème à résoudre

L'interface actuelle contient **trop de texte**, trop de blocs d'explication et pas assez de visuels. Elle paraît chargée et peu professionnelle.

## Direction artistique

- **Sobre et aéré** : beaucoup d'espace blanc, fond gris très clair (#F4F5F7), cartes blanches.
- **Orange de la marque** utilisé avec parcimonie : boutons principaux, onglet actif, prix, petits accents. Pas en aplat partout.
- **Couleur neutre foncée** (bleu marine ou anthracite) pour les titres et boutons secondaires, afin de laisser l'orange respirer.
- **Typographie** : une seule famille, hiérarchie claire (titre 20-22, section 17, corps 14, détail 12), graisses 400/600/700.
- **Arrondis cohérents** : 12 px pour les boutons, 20 px pour les cartes, 999 px pour les pastilles.
- **Ombres très légères** ou simples bordures fines (#E7EAEF), jamais lourdes.

## Remplacer le texte par du visuel

- Chaque service ou formule a une **illustration** (voiture vue de côté, style vectoriel plat) dans une zone teintée, plus de petites **icônes** (carrosserie, intérieur, durée) à la place des phrases d'explication.
- Une teinte douce par niveau de formule (bleu, vert, orange, violet) pour les reconnaître d'un coup d'œil.
- Supprime les bandeaux et phrases explicatives longues. Remplace-les par des icônes, des pastilles courtes ou une info qui s'affiche au toucher.
- Les promotions : carte visuelle avec illustration, grand pourcentage, code à copier. Pas de texte posé sur une photo.
- Laveurs et stations : avatar ou photo, note en étoiles, statut (en ligne), distance, un seul bouton d'action clair.
- **États vides, chargements et erreurs** : une petite illustration, une phrase courte, une action. Utilise des *skeleton loaders* au lieu de simples cercles de chargement.
- Illustrations : crée-les en SVG ou utilise des assets libres de droits, dans un style cohérent. N'invente jamais de logo.

## Règles de rédaction

- Titres courts (2-3 mots). Un bouton dit exactement ce qu'il fait : "Réserver", "Payer", "Voir le suivi".
- Maximum une ligne de description par élément. Si c'est plus long, c'est un détail qui s'ouvre au toucher.

## Composants et navigation

- Crée d'abord un **design system** centralisé : couleurs, typographie, espacements (multiples de 4/8), rayons, ombres. Aucune valeur écrite en dur dans les écrans.
- Compose-le de composants réutilisables : bouton (principal, secondaire, texte), carte de service, carte de laveur, pastille, en-tête, champ de saisie, barre de navigation, feuille modale.
- Barre de navigation du bas : icônes plus lisibles, onglet actif en orange, libellés courts.
- Zones tactiles d'au moins 48 px. Contraste de texte conforme (WCAG AA).
- Animations discrètes uniquement : transition de page, appui sur un bouton, apparition d'une feuille. Pas d'effets décoratifs.

## Méthode de travail

1. **Audit** : liste tous les écrans et composants actuels, repère les incohérences (couleurs, tailles, marges) et résume-les en 10 lignes maximum.
2. **Design system** : propose-le et crée le thème et les composants de base.
3. **Refonte écran par écran**, dans cet ordre : Accueil, Réserver (parcours complet), Détail laveur / station, Suivi du lavage, Abonnements, Portefeuille, Profil, Connexion et inscription.
4. Après chaque écran : vérifie que l'app compile, que la navigation fonctionne et que les données s'affichent comme avant. Corrige avant de continuer.
5. **Final** : passe en revue l'ensemble pour harmoniser les espacements, tester sur petit écran (360 px de large) et grand écran, vérifier le mode sombre s'il existe, et lister ce qui a changé.

## Livrables attendus

- Le code refondu, propre et commenté là où c'est utile.
- Un court récapitulatif : écrans modifiés, nouveaux composants, assets ajoutés.
- La liste de tout ce que tu n'as pas pu faire ou sur quoi tu as un doute. Pose-moi la question au lieu de deviner.

## Avant de commencer

Confirme-moi en 5 lignes que tu as compris, indique les couleurs et le logo que tu as retrouvés dans le code, puis attends mon accord pour lancer l'étape 2.
