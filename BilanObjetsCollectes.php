<?php
require('actions/users/securityAction.php');
require('actions/objets/insertObjetDsDb.php');
require('actions/objets/recupDb.php');
require('actions/objets/getSommePoids.php');
require('actions/objets/miseAJourDb.php');
?>

<!DOCTYPE HTML>
<html lang="fr-FR">
    <?php include("includes/head.php");?>
    <body class="corps">
        <?php
            $lineheight = "uneligne";
            $src = 'image/PictoFete.gif';
            $alt = 'un oiseau qui fait la fête.';
            $titre = 'Objets collectés';
            include("includes/header.php");
            $page = 3;
            include("includes/nav.php");
        ?>
        
        <?php
        if($_SESSION['admin'] >= 1){
        ?>
        
        <?php if(isset($message)){
            echo '<p style="text-align: center;">'.$message.'</p>';
        }
        ?>
        
        <p style="text-align: center;"> Poids Total d'objets <b>collectés</b> toute catégorie confondue : <?php
        $poids_total_obj_collecte_kg = round($poids_total_obj_collecte['poids_total']/1000000,1);
        echo $poids_total_obj_collecte_kg.' T';
        ?> </p>

        <p style="text-align: center;"> Ceci correspond à  <?php echo $totalObjets;
        ?> saisis sur la balance. </p>
        
        <!-- Boutons pour afficher toute la base de données ou les différentes années -->
        <div style="text-align: center; margin-bottom: 20px;">
            <form method="get" action="">
                <button type="submit" name="year" value="all">Afficher toute la base de données</button>
                <button type="submit" name="year" value="2024">2024</button>
                <button type="submit" name="year" value="2023">2023</button>
                <button type="submit" name="year" value="2022">2022</button>
                <!-- Ajoutez d'autres années si nécessaire -->
            </form>
        </div>
        
        <!-- Formulaire pour trier et paginer les objets -->
        <form method="get">
            <fieldset class="jeuchamp">
                <label class="champ" for="tri">Trier par : </label>
                <select id="tri" name="tri">
                    <option value="nom" <?php if($tri == 'nom') echo 'selected'; ?>>Nom</option>
                    <option value="categorie" <?php if($tri == 'categorie') echo 'selected'; ?>>Catégorie</option>
                    <option value="poids" <?php if($tri == 'poids') echo 'selected'; ?>>Poids</option>
                    <option value="timestamp" <?php if($tri == 'timestamp') echo 'selected'; ?>>Date d'ajout</option>
                </select>
                <select id="order" name="order">
                    <option value="ASC" <?php if($order == 'ASC') echo 'selected'; ?>>Croissant</option>
                    <option value="DESC" <?php if($order == 'DESC') echo 'selected'; ?>>Décroissant</option>
                </select>
                <input type="hidden" name="year" value="<?php echo isset($_GET['year']) ? $_GET['year'] : 'all'; ?>">
            </fieldset>
            <fieldset class="jeuchamp">
                <label class="champ" for="perPage">Objets par page : </label>
                <select id="perPage" name="perPage">
                    <option value="50" <?php if($perPage == 50) echo 'selected'; ?>>50</option>
                    <option value="100" <?php if($perPage == 100) echo 'selected'; ?>>100</option>
                    <option value="200" <?php if($perPage == 200) echo 'selected'; ?>>200</option>
                </select>
                <input type="hidden" name="year" value="<?php echo isset($_GET['year']) ? $_GET['year'] : 'all'; ?>">
            </fieldset>
            <input type="submit" class="input inputsubmit" name="validate" value="Appliquer">
        </form>
        
        <!-- Tableau pour afficher les objets collectés -->
        <table class="tableau">
            <tr class="ligne">
                <th class="cellule_tete">Id</th>
                <th class="cellule_tete">flux</th>
                <th class="cellule_tete">Catégorie</th>
                <th class="cellule_tete">Sous-Catégorie</th>
                <th class="cellule_tete">Précision</th>
                <th class="cellule_tete">Poids en gramme</th>
                <th class="cellule_tete">Date d'insertion</th>
            </tr>
        
            <?php
            // Boucle pour afficher chaque objet collecté dans une ligne du tableau
            foreach($getObjets as list($id, $nom, $type, $souscat, $poids, $date, $timestamp, $flux)){
                echo '<tr class="ligne">
                    <td class="colonne">'.$id.'</td>
                    <td class="colonne">'.$flux.'</td>
                    <td class="colonne">'.$type.'</td>
                    <td class="colonne">'.$souscat.'</td>
                    <td class="colonne">'.$nom.'</td>
                    <td class="colonne">'.$poids.'</td>
                    <td class="colonne">'.$date.'</td>
                    <td class="colonne"><a href="modifObjet.php?id='.$id.'">Modifier</a></td>
                    <td class="colonne"><a href="actions/objets/supprObjetAction.php?id='.$id.'">Supprimer</a></td>
                </tr>';
            }
            ?>
        </table>
        
        <!-- Pagination pour naviguer entre les pages d'objets -->
        <div class="pagination">
            <?php
            if ($totalPages > 1) {
                $yearParam = isset($_GET['year']) ? '&year='.$_GET['year'] : '';
                if ($page > 1) {
                    echo '<a href="?page='.($page-1).'&perPage='.$perPage.'&tri='.$tri.'&order='.$order.$yearParam.'" class="page-link">Précédent</a>';
                }
                if ($page > 3) {
                    echo '<a href="?page=1&perPage='.$perPage.'&tri='.$tri.'&order='.$order.$yearParam.'" class="page-link">1</a>';
                    if ($page > 4) {
                        echo '<span class="page-link">...</span>';
                    }
                }
                for ($i = max(1, $page - 2); $i <= min($totalPages, $page + 2); $i++) {
                    if ($i == $page) {
                        echo '<span class="page-link active">'.$i.'</span>';
                    } else {
                        echo '<a href="?page='.$i.'&perPage='.$perPage.'&tri='.$tri.'&order='.$order.$yearParam.'" class="page-link">'.$i.'</a>';
                    }
                }
                if ($page < $totalPages - 2) {
                    if ($page < $totalPages - 3) {
                        echo '<span class="page-link">...</span>';
                    }
                    echo '<a href="?page='.$totalPages.'&perPage='.$perPage.'&tri='.$tri.'&order='.$order.$yearParam.'" class="page-link">'.$totalPages.'</a>';
                }
                if ($page < $totalPages) {
                    echo '<a href="?page='.($page+1).'&perPage='.$perPage.'&tri='.$tri.'&order='.$order.$yearParam.'" class="page-link">Suivant</a>';
                }
            }
            ?>
        </div>
        
        <?php
        } else {
            // Message affiché si l'utilisateur n'est pas administrateur
            echo 'Vous n\'êtes pas administrateur, veuillez contacter le webmaster svp';
        }
        include('includes/footer.php'); // Inclusion du fichier footer
        ?>
    </body>
</html>
