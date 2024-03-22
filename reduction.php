<?php
require('actions/db.php');
require('app/bootstrap.php');

?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Reduction</title>
<link rel="stylesheet" href="formulaire.css">
</head>
<body>

<div class="container-formulaire">
    <div class="container-formulaire2">
        <h2>Reduction</h2>
        <!-- Comme tu utilises du POST pour envoyer ton formulaire, tu vas transmettre l'id_temp_vente en POST via un input hidden -->
        <form action="traitement.php" method="POST">
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
                <input type="text" id="montant" name="montant" required>
            </div>
            <div class="boutton">
                <label for="date_fin">Date de fin:</label>
                <input type="date" id="date_fin" name="date_fin" required>
            </div>
            <div class="boutton">
                <input type="hidden" id="modifouinsert" name="modifouinsert" value="i">
            </div>
            <!-- voilà l'input en question en modifiant la value pour ça fonctionne
                <div class="boutton">
                    <input type="hidden" id="id_temp_vente" name="id_temp_vente" value="<balise php>$_GET['id_temp_vente']</balise php>">
                </div>
            -->
            <div class="Envoyer">
                <input type="submit" value="Envoyer">
            </div>
        </form>
    </div>
</div>

<!-- modifier ou supprimer-->
<?php

try {
    // Récupération des réductions en cours
    $sel = "SELECT * FROM reduction";
    $selectred = $db->query($sel);
    if ($selectred->rowCount() > 0) {
        // Affichage des réductions en cours avec possibilité de modification ou suppression
        echo "<table>";
        echo "<tr><th>ID</th><th>Catégorie</th><th>Montant</th><th>Date de fin</th><th>Action</th></tr>";
        while ($row = $selectred->fetch(PDO::FETCH_ASSOC)) {
            echo "<tr>";
            echo "<td>".$row["id"]."</td>";
            echo "<td>".$row["categorie"]."</td>";
            echo "<td>".$row["montant"]."</td>";
            echo "<td>".$row["date_fin"]."</td>";
            echo "<td><a href='modifreduc.php?id=".$row["id"]."'>Modifier</a> | <a href='supreduc.php?id=".$row["id"]."&action=delete'>Supprimer</a></td>";
            echo "</tr>";
        }
        echo "</table>"; // déplacement de la fermeture de la balise table à l'extérieur de la boucle while
    } else {
        echo "Aucune réduction enregistrée.";
    }
} catch (Exception $e) {
    die('Une erreur a été trouvée : ' . $e->getMessage());
}
?>
</body>

<div class="retour">
    <a href="objetsVendus.php?id_temp_vente=<?php $_POST['id_temp_vente']; ?>">Retour</a>
</div>

</html>


