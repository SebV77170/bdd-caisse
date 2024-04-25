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
        $poids_total_obj_collecte_kg = $poids_total_obj_collecte['poids_total']/1000;
        echo $poids_total_obj_collecte_kg.' Kg';
        ?> </p>

    <div class="container">
        <div class="row">
            <div class="col">
                <!-- formulaire affichage d'année -->
                <form method="get">
                    <fieldset class="jeuchamp">
                        <label class="champ" for="annee">Afficher l'année : </label>
                        <select id="annee" name="annee">
                            <option value="2023">2023</option>
                            <option value="2024">2024</option>
                        </select>               
                    </fieldset>          
                    <input type="submit" class="input inputsubmit" name="affichage-annee" value="Afficher">
                </form>
                <!-- fin formulaire affichage d'année -->
            </div>
            <div class="col">
                <!-- formulaire de tri -->
                <form method="get">
                    <fieldset class="jeuchamp">
                        <label class="champ" for="tri">Trier par : </label>
                        <select id="tri" name="tri">
                            <option value="nom">Nom</option>
                            <option value="categorie">Catégorie</option>
                            <option value="poids">Poids</option>
                            <option value="timestamp">Date d'ajout</option>
                        </select>               
                    </fieldset>          
                    <input type="submit" class="input inputsubmit" name="validate" value="Trier">
                </form>
                <!-- fin de formulaire de tri -->
            </div>
        </div>
    </div>
        <table class="tableau">
            <tr class="ligne">
                <th class="cellule_tete">Categories</th>
                <th class="cellule_tete">Poids total</th>
                <th class="cellule_tete">Pourcentage</th>
            </tr>
            
        <?php
        
        foreach($LesSommes as list($categorie, $poids_total_par_cat)){
            $poids_total_par_cat_kg = $poids_total_par_cat/1000;
            $pourcentage = round((($poids_total_par_cat_kg * 100) / $poids_total_obj_collecte_kg),1);
            echo '<tr class="ligne">
                        
                            <td class="colonne">'.$categorie.'</td>
                            <td class="colonne">'.$poids_total_par_cat_kg.' kg</td>
                            <td class="colonne">'.$pourcentage.'%</td> 

                          </tr>'  ;
        }
        ?>
            
            
        </table>
        
        
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
        
        <?php foreach($getObjets as list($id, $nom, $type, $souscat, $poids, $date, $timestamp, $flux)){
                    
        
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
                            
                          </tr>'  ;
        }
        ?>
        </table>
        
        <?php
            }else{
                echo 'Vous n\'êtes pas administrateur, veuillez contacter le webmaster svp';
            }
            include('includes/footer.php');
            ?>
    </body>
</html>