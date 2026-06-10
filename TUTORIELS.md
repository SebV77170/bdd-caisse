# Génération des tutoriels

Le dépôt contient un générateur de tutoriel qui pilote automatiquement
l'application Electron avec une base de démonstration.

Il produit :

- des captures PNG annotées ;
- un fichier `tutoriel.json` contenant les textes et l'ordre des étapes ;
- une page `index.html` autonome, prête à être publiée.

## Générer le parcours standard

Depuis la racine du projet :

```powershell
npm run tutorial:generate
```

Le résultat est créé dans :

```text
tutorial-output/parcours-standard/
```

## Générer la présentation des menus

```powershell
npm run tutorial:menus
```

Le résultat est créé dans :

```text
tutorial-output/presentation-menus/
```

Ouvrir `index.html` dans un navigateur pour contrôler le tutoriel.

## Modifier les commentaires

Le scénario et les commentaires se trouvent dans :

```text
scripts/tutorial/generate-standard-tutorial.js
```

Chaque appel à `capture` définit :

```js
await capture(
  6,
  'nouvelle-vente',
  'Créer une nouvelle vente',
  'Cliquez sur « Nouvelle vente » avant d’ajouter les articles du client.',
  { targetText: 'Nouvelle vente' }
);
```

- le premier argument est le numéro de l'étape ;
- le deuxième sert au nom du fichier PNG ;
- le troisième est le titre ;
- le quatrième est le commentaire ;
- `targetText` encadre un élément selon son texte ;
- `selector` permet de cibler précisément un élément avec un sélecteur CSS.

## Publication

Pour une publication simple, transférer tout le contenu du dossier
`tutorial-output/parcours-standard` dans un répertoire du site de formation.
Les chemins des images sont relatifs, la page peut donc fonctionner sans
modification.

Le fichier `tutoriel.json` peut également être importé par un futur thème
WordPress ou une plateforme de formation pour construire sa propre mise en
page.
