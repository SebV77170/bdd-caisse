<?php
// Connexion à la base de données
require('actions/db.php');

try {
    // Récupération des données du formulaire
    $categorie = $_POST['categorie'];
    $montant = $_POST['montant'];
    $date_fin = $_POST['date_fin'];

    // Préparation de la requête d'insertion
    $insertreduction = $db->prepare("INSERT INTO reduction (categorie, montant, date_fin) VALUES (?, ?, ?)");

    // Liaison des paramètres
    $insertreduction->bindParam(1, $categorie);
    $insertreduction->bindParam(2, $montant);
    $insertreduction->bindParam(3, $date_fin);

    // Exécution de la requête
    if ($insertreduction->execute()) {
        echo "Réduction ajoutée avec succès !";
    } else {
        echo "Erreur : " . $insertreduction->errorInfo()[2];
    }

    // Fermeture de la connexion
    $insertreduction = null;
    $db = null;
} catch (Exception $e) {
    die('Une erreur a été trouvée : ' . $e->getMessage());
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="formulaire.css">
    <title>Document</title>
</head>
<body>
    <div class="retour">
    <a href="objetsVendus.php">retour</a>
    </div>
</body>
</html>