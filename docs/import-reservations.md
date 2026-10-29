# Importer les réservations (CSV)

Réservations → Gestion → **Importer un CSV**. Un aperçu s'affiche avant tout import : rien n'est enregistré tant que vous n'avez pas validé.

## En bref

1. **Créez d'abord les tarifs** de la soirée dans Gestion (Adulte, Enfant, Étudiant…).
2. Dans le tableur, une ligne d'en-têtes puis **une ligne par réservation**.
3. Nommez **une colonne par tarif, comme le tarif** (« Adulte », « Enfant »…).
4. Enregistrez en CSV : Excel → *CSV (séparateur : point-virgule)* ou *CSV UTF-8* ; Google Sheets → *Fichier → Télécharger → CSV*.

Exemple qui passe tel quel (tarifs Adulte, Enfant, Étudiant) :

```csv
Nom;Prénom;Adulte;Enfant;Étudiant;Téléphone;Table;Allergies;Payé
Dupont;Jean;2;1;;06 12 34 56 78;4;;non
Lefèvre;Marie;1;;2;;7;sans gluten;oui
Martin;;3;2;;;;arachides;
```

## Les noms de colonnes

Pas besoin d'être exact : majuscules, accents, ponctuation et pluriels sont ignorés, et l'ordre des colonnes n'a aucune importance. Une colonne est reconnue si son en-tête **contient** l'un de ces mots :

| Colonne | Mots reconnus | Obligatoire |
|---|---|---|
| Nom | nom, name, famille, client | **oui** |
| Prénom | prénom (collé après le nom : « Dupont Jean ») | non |
| Un tarif | le nom du tarif (voir plus bas) | **au moins un** |
| Téléphone | tél, téléphone, phone, portable, mobile | non |
| Table | table (« 12 », « 12-13 », « Terrasse » ; 20 caractères max) | non |
| Remarque | remarque, commentaire, note, allergie, régime, info | non |
| Payé d'avance | payé, réglé, paiement, acompte | non |

Exemples : « NOM », « Nom de famille », « Nom Prénom » (une seule colonne), « N° de portable », « Allergies / régime » passent tous.

Les colonnes qui ne correspondent à rien (Mail, Total…) sont **ignorées** et listées en haut de l'aperçu. Si une colonne de tarif y apparaît, c'est que son nom n'a pas été reconnu : renommez-la ou ajoutez le tarif dans Gestion, puis réimportez.

### Colonnes de tarif

Une colonne va au tarif avec lequel elle partage un mot. Les petits mots sont ignorés : *nb, nombre, de, des, repas, tarif, personnes, pers*, ainsi que tout mot de moins de 3 lettres.

- « Nb adultes », « Adultes », « Repas adulte » → **Adulte**
- « Étudiants » → **Étudiant**
- « Enf. », « Adu », « Grands » → **non reconnus** : le mot doit être entier.

**Conseil :** le plus sûr est de reprendre exactement le nom du tarif. Évitez les en-têtes qui pourraient aller à deux tarifs : avec les tarifs « Enfant » et « Moins de 3 ans », une colonne « Enfants (-12 ans) » partage « enfant » avec le premier et « ans » avec le second. Elle ira alors au tarif placé le plus haut dans la liste.

Une même réservation peut avoir des personnes dans plusieurs tarifs.

## Les valeurs

- **Nombre de personnes** : un entier (0 à 999). Une case vide vaut 0. « 2 adultes », « deux » ou « 1,5 » font rejeter la ligne.
- **Il faut au moins une personne** par ligne, sinon la ligne est rejetée.
- **Payé** : *oui, o, x, 1, ok, yes, vrai, payé, réglé* valent « payé d'avance ». Tout le reste, y compris une case vide, « CB » ou « 48 € », vaut « non payé ». Attention : une colonne « Mode de paiement » qui contient « virement » sera comprise comme **non payé**.
- **Plusieurs colonnes de remarque** (Remarque, Allergies…) sont regroupées : « Remarque : anniversaire · Allergies : sans gluten ». Avec une seule colonne, seule la valeur est gardée. La **table** a sa propre colonne : ne la mettez pas en remarque, sinon chaque réservation apparaît dans « À surveiller ».
- **Téléphone** : texte libre. On peut ensuite rechercher la réservation à l'accueil en tapant 3 chiffres ou plus du numéro.
- Longueur maximum : nom 120 caractères, téléphone 40, remarque 200. Au-delà, le texte est coupé.

## Ce que fait l'aperçu

- **Lignes illisibles** (nom manquant, nombre invalide, aucune personne) : listées en rouge avec leur numéro de ligne, et **non importées**. Corrigez le fichier et réimportez : les lignes déjà importées seront détectées comme doublons.
- **Doublons** (même nom, sans tenir compte des accents ni de la casse, déjà dans la liste ou plus haut dans le fichier) : décochés par défaut. Réimporter le même fichier ne crée donc pas de doublons. Cochez la ligne si ce sont vraiment deux familles différentes.
- Les lignes entièrement vides sont ignorées.

Pour repartir de zéro avec une liste corrigée : Gestion → **Vider la liste** (les réservations déjà arrivées sont gardées), puis réimportez.

## Format technique (si le fichier vient d'ailleurs)

- Séparateur `;`, `,` ou tabulation : il est détecté automatiquement sur la ligne d'en-têtes.
- Encodage UTF-8 (avec ou sans BOM) ou Windows-1252 (ce qu'Excel produit en France) : détecté automatiquement, les accents passent dans les deux cas.
- Si une valeur contient le séparateur, elle doit être entre guillemets : `"Dupont; Jean"`. Excel et Sheets le font tout seuls.
