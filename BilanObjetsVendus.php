<?php
require('actions/users/securityAction.php');
require('actions/objets/recupDBvendus.php');
require('actions/objets/getSommePrixVendus.php');
?>

<!DOCTYPE HTML>
<html lang="fr-FR">
    <?php include("includes/head.php");?>
    <body class="corps">
        <?php
            $lineheight = "uneligne";
            $src = 'image/PictoFete.gif';
            $alt = 'un oiseau qui fait la fête.';
            $titre = 'Encaissement';
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
        
        <p style="text-align: center;"> Prix Total d'objets <b>vendus</b> toute catégorie confondue : <?php
        $prix_total_obj_collecte_kg = round($prix_total_obj_collecte['prix_total']/100, 1);
        echo $prix_total_obj_collecte_kg.' €';
        ?> </p>
        
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
        
        <form method="get">
            <fieldset class="jeuchamp">
                <label class="champ" for="tri">Trier par : </label>
                <select id="tri" name="tri">
                    <option value="nom" <?php if($tri == 'nom') echo 'selected'; ?>>Nom</option>
                    <option value="categorie" <?php if($tri == 'categorie') echo 'selected'; ?>>Catégorie</option>
                    <option value="prix" <?php if($tri == 'prix') echo 'selected'; ?>>Prix</option>
                    <option value="timestamp" <?php if($tri == 'timestamp') echo 'selected'; ?>>Date d'ajout</option>
                </select>
                <select id="order" name="order">
                    <option value="ASC" <?php if($order == 'ASC') echo 'selected'; ?>>Croissant</option>
                    <option value="DESC" <?php if($order == 'DESC') echo 'selected'; ?>>Décroissant</option>
                </select>
            </fieldset>
            <fieldset class="jeuchamp">
                <label class="champ" for="perPage">Objets par page : </label>
                <select id="perPage" name="perPage">
                    <option value="50" <?php if($perPage == 50) echo 'selected'; ?>>50</option>
                    <option value="100" <?php if($perPage == 100) echo 'selected'; ?>>100</option>
                    <option value="200" <?php if($perPage == 200) echo 'selected'; ?>>200</option>
                </select>
            </fieldset>
            <input type="submit" class="input inputsubmit" name="validate" value="Appliquer">
        </form>
        
        <table class="tableau">
            <tr class="ligne">
                <th class="cellule_tete">Categories</th>
                <th class="cellule_tete">Prix total</th>
                <th class="cellule_tete">Pourcentage</th>
            </tr>
            
            <?php
            foreach($LesSommes as list($categorie, $prix_total_par_cat)){
                $prix_total_par_cat_euro = $prix_total_par_cat/100;
                $pourcentage = round((($prix_total_par_cat_euro * 100) / $prix_total_obj_collecte_kg), 1);
                echo '<tr class="ligne">
                    <td class="colonne">'.$categorie.'</td>
                    <td class="colonne">'.$prix_total_par_cat_euro.' €</td>
                    <td class="colonne">'.$pourcentage.'%</td>
                </tr>';
            }
            ?>
        </table>
        
        <table class="tableau">
            <tr class="ligne">
                <th class="cellule_tete">Nom</th>
                <th class="cellule_tete">Nom du vendeur</th>
                <th class="cellule_tete">Catégorie</th>
                <th class="cellule_tete">Sous-Catégorie</th>
                <th class="cellule_tete">Date de vente</th>
                <th class="cellule_tete">Prix en €</th>
            </tr>
        
            <?php
            foreach($getObjets as list($nom, $nom_vendeur, $type, $souscat, $date_vente, $timestamp, $prix)){
                $prixeuro = $prix/100;
                echo '<tr class="ligne">
                    <td class="colonne">'.$nom.'</td>
                    <td class="colonne">'.$nom_vendeur.'</td>
                    <td class="colonne">'.$type.'</td>
                    <td class="colonne">'.$souscat.'</td>
                    <td class="colonne">'.$date_vente.'</td>
                    <td class="colonne">'.$prixeuro.'€</td>
                </tr>';
            }
            ?>
        </table>
        
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
            echo 'Vous n\'êtes pas administrateur, veuillez contacter le webmaster svp';
        }
        include('includes/footer.php');
        ?>
    </body>
</html>
