<?php
// Connexion à la base de données (inclus votre fichier db.php)
require('actions/db.php');

// Vérifier si l'ID de la réduction est passé dans la requête GET
if(isset($_GET['id'])) {
    $id_to_edit = $_GET['id'];

    // Sélection de la réduction à modifier depuis la base de données
    $sql = "SELECT * FROM reduction WHERE id = :id";
    $stmt = $db->prepare($sql);
    $stmt->bindParam(':id', $id_to_edit);
    $stmt->execute();
    $reduction = $stmt->fetch(PDO::FETCH_ASSOC);
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="formulaire.css">
    <title>Modifier une réduction</title>
</head>
<body>
<div class="container-formulaire">
    <div class="container-formulaire2">
        <h2>Modifier une réduction</h2>
        <form action="traitement.php" method="post">
            <input type="hidden" name="id" value="<?php echo $reduction['id']; ?>">
            <div class="boutton">
                <label class="champ" for="type2">Catégorie : </label>
                <select id="type2" name="categorie">
                    <option value="">Sélectionner une catégorie</option>
                    
                    <!--Va chercher les catégories dans la table categories-->
                    
                    <?php
                    $result = $db->prepare('SELECT * FROM categories WHERE parent_id = "parent"');
                    $result->execute();
                    
                    while($row = $result->fetch(PDO::FETCH_BOTH)){
                        ?><option value="<?php echo $row['id'];?>"><?php echo $row['category'];?></option>
                        <?php
                    }
                    ?>
                </select>
            </div>
            <div class="boutton">
                <label for="montant">Montant:</label>
                <input type="text" id="montant" name="montant" value="<?php echo $reduction['montant']; ?>" required>
            </div>
            <div class="boutton">
                <label for="date_fin">Date de fin:</label>
                <input type="date" id="date_fin" name="date_fin" value="<?php echo $reduction['date_fin']; ?>" required>
            </div>
            <div class="boutton">
                <input type="hidden" id="modifouinsert" name="modifouinsert" value="m">
            </div>
            <div class="Envoyer">
                <input type="submit" value="Modifier">
            </div>
        </form>
    </div>
</div>
<div class="retour">
    <a href="reduction.php">retour</a>
    </div>
</body>
</html>
