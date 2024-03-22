<?php
// Connexion à la base de données
require('actions/db.php');

try {
    // Récupération des données du formulaire
    if(isset($_POST['id'])):
        $id = $_POST['id'];
    endif;
    $categorie = $_POST['categorie'];
    $montant = $_POST['montant'];
    $date_fin = $_POST['date_fin'];
    $modifOUinsert = $_POST['modifouinsert'];

    // Préparation de la requête d'insertion
    if($modifOUinsert == "i"):
        $insertreduction = $db->prepare("INSERT INTO reduction (categorie, montant, date_fin) VALUES (?, ?, ?)");
        // Liaison des paramètres
        $insertreduction->bindParam(1, $categorie);
        $insertreduction->bindParam(2, $montant);
        $insertreduction->bindParam(3, $date_fin);
    elseif($modifOUinsert == "m"):    
        // requete update 
        $insertreduction = $db->prepare("UPDATE reduction   SET   montant = ?, date_fin = ? WHERE id = ? ");
         $insertreduction->execute(array($montant,$date_fin,$id));
    endif;


    
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

<!-- ici, tu va utiliser du coup ton id_temp_vente que tu as transmis en POST via ton formulaire -->
<div class="retour">
    <a href="objetsVendus.php?id_temp_vente=<?php $_POST['id_temp_vente']; ?>">Retour</a>
</div>


</body>
</html>