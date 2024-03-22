<?php
// Connexion à la base de données (inclus votre fichier db.php)
require('actions/db.php');

// Vérifier si l'ID de la réduction est passé dans la requête GET
if(isset($_GET['id']) && isset($_GET['action']) && $_GET['action'] === 'delete') {
    $id_to_delete = $_GET['id'];
    
    // Suppression de la réduction de la base de données
    $sql = "DELETE FROM reduction WHERE id = :id";
    $stmt = $db->prepare($sql);
    $stmt->bindParam(':id', $id_to_delete);
    
    if($stmt->execute()) {
        echo "La réduction a été supprimée avec succès.";
    } else {
        echo "Une erreur s'est produite lors de la suppression de la réduction.";
    }
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="formulaire.css">
    <title>Supprimer une reduction</title>
</head>
<body>
<div class="retour">
    <a href="objetsVendus.php?id_temp_vente=<?php $_POST['id_temp_vente']; ?>">Retour</a>
</div>
</body>
</html>
