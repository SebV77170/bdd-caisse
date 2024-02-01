<?php
require('actions/db.php');
require('actions/objets/currencyToDecimalFct.php');
require('actions/users/securityAction.php');
require('actions/objets/modifPrixObjetTC.php');
require('actions/objets/modifNbr.php');
require('actions/objets/objetsVendusAction.php');
require('actions/objets/ticketDeCaisseAction.php');
require('actions/objets/compteObjetDsTCtemp.php');
require('actions/objets/getPoidsTotal.php');
require('actions/objets/getDBVenteTemp.php');
require('actions/objets/modifDate.php');
require('actions/objets/recupBoutonsCaisse.php');
require('app/bootstrap.php');

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
    $page = 2;
    include("includes/nav.php");
    include("includes/nav_vente.php");
   
    if($_SESSION['admin'] >= 1){
    ?>
         
         <div class="accordion d-md-none d-lg-none d-xl-none d-xxl-none">  
            <div class="accordion-item">
                <h2 class="accordion-header" id="headingOne">
                    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#panelsStayOpen-collapseOne" aria-expanded="true" aria-controls="collapseOne">
                    Saisie manuelle
                    </button>
                </h2>
                <div id="#panelsStayOpen-collapseOne" class="accordion-collapse collapse show" aria-labelledby="headingOne" data-bs-parent="#accordionExample">
                    <div class="accordion-body">
                        <!--Formulaire de vente--> 

                        <?php
                        if($_GET['modif']==1):
                        ?>
                            
                        <h2 style="text-align: center;">Si vous souhaitez changer la date de la vente.</h2>
                        
                        <form class="vente" method="post">
                            <fieldset class="jeuchamp">
                                <label class="champ" for="date">Date de la vente : </label>
                                <input name="date" type="text" placeholder="dd-mm-YYYY">
                                <input type="submit" class="input inputsubmit" name="modifierDate" value="Modifier">
                            </fieldset>
                        </form>

                        <?php
                        if(isset($message)):
                            var_dump($message);
                        endif;
                        ?>
                        
                        <h2 style="text-align: center;">Sinon, modifiez ici la vente.</h2>

                        <?php
                        endif;
                        ?>
                                    
                        <form classe="vente" method="post">
                        
                            <fieldset class="jeuchamp">
                        
                                <label class="champ" for="nom">Nom ou description sommaire de l'objet : </label>
                                <input type="text" name="nom">

                                <input type="hidden" name="modif" value=<?=$_GET['modif']?>>
                                <?php
                                if(isset($_GET['id_modif'])):
                                ?>
                                <input type="hidden" name="id_modif" value=<?=$_GET['id_modif']?>>
                                <?php
                                endif;
                                ?>
                        
                                <label class="champ" for="type2">Catégorie : </label>
                                <select id="type2" name="type2">
                                    <option value="">Sélectionner une catégorie</option>
                                    
                                    <!--Va chercher les catégories dans la table categories-->
                                    
                                    <?php
                                    $result = $db->prepare('SELECT * FROM categories WHERE parent_id = "parent"');
                                    $result->execute();
                                    
                                    while($row = $result->fetch(PDO::FETCH_BOTH)){
                                        ?><option value="<?php echo $row['category'];?>"><?php echo $row['category'];?></option>
                                        <?php
                                    }
                                    ?>
                                </select>
                                
                                <!--Attention, id importante sub-category-dropdown car liée au script en bas du fichier, ceci afin de liée catégories et sous catégories-->
                                
                                <label class="champ" for="SUBCATEGORY">Sous-catégorie :</label>
                                <select id="sub-category-dropdown2" name="souscategorie">
                                    <option value="">Sélectionner une sous-catégorie</option>
                                </select>
                                
                                <button type="button" onclick="getValue();">Ajouter une sous-catégorie</button>
                                
                        
                                <label class="champ" for="prix">Prix: </label>
                                <input type="prix" name="prix">
                            
                            </fieldset>
                    
                            <input type="submit" class="input inputsubmit" name="validate" value="Vendre">
                        
                        </form>
                    </div>
                </div>
            </div> 
        </div>  

        <div class="accordion d-none d-md-block d-lg-block d-xl-block d-xxl-block">  
            <div class="accordion-item">
                <h2 class="accordion-header" id="headingOne">
                    <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="false" aria-controls="collapseOne">
                    Saisie manuelle
                    </button>
                </h2>
                <div id="collapseOne" class="accordion-collapse collapse" aria-labelledby="headingOne" data-bs-parent="#accordionExample">
                    <div class="accordion-body">
                        <!--Formulaire de vente--> 

                        <?php
                        if($_GET['modif']==1):
                        ?>
                            
                        <h2 style="text-align: center;">Si vous souhaitez changer la date de la vente.</h2>
                        
                        <form class="vente" method="post">
                            <fieldset class="jeuchamp">
                                <label class="champ" for="date">Date de la vente : </label>
                                <input name="date" type="text" placeholder="dd-mm-YYYY">
                                <input type="submit" class="input inputsubmit" name="modifierDate" value="Modifier">
                            </fieldset>
                        </form>

                        <?php
                        if(isset($message)):
                            var_dump($message);
                        endif;
                        ?>
                        
                        <h2 style="text-align: center;">Sinon, modifiez ici la vente.</h2>

                        <?php
                        endif;
                        ?>
                                    
                        <form classe="vente" method="post">
                        
                            <fieldset class="jeuchamp">
                        
                                <label class="champ" for="nom">Nom ou description sommaire de l'objet : </label>
                                <input type="text" name="nom">

                                <input type="hidden" name="modif" value=<?=$_GET['modif']?>>
                                <?php
                                if(isset($_GET['id_modif'])):
                                ?>
                                <input type="hidden" name="id_modif" value=<?=$_GET['id_modif']?>>
                                <?php
                                endif;
                                ?>
                        
                                <label class="champ" for="type1">Catégorie : </label>
                                <select id="type1" name="type1">
                                    <option value="">Sélectionner une catégorie</option>
                                    
                                    <!--Va chercher les catégories dans la table categories-->
                                    
                                    <?php
                                    $result = $db->prepare('SELECT * FROM categories WHERE parent_id = "parent"');
                                    $result->execute();
                                    
                                    while($row = $result->fetch(PDO::FETCH_BOTH)){
                                        ?><option value="<?php echo $row['category'];?>"><?php echo $row['category'];?></option>
                                        <?php
                                    }
                                    ?>
                                </select>
                                
                                <!--Attention, id importante sub-category-dropdown car liée au script en bas du fichier, ceci afin de liée catégories et sous catégories-->
                                
                                <label class="champ" for="SUBCATEGORY">Sous-catégorie :</label>
                                <select id="sub-category-dropdown1" name="souscategorie">
                                    <option value="">Sélectionner une sous-catégorie</option>
                                </select>
                                
                                <button type="button" onclick="getValue();">Ajouter une sous-catégorie</button>
                                
                        
                                <label class="champ" for="prix">Prix: </label>
                                <input type="prix" name="prix">
                            
                            </fieldset>
                    
                            <input type="submit" class="input inputsubmit" name="validate" value="Vendre">
                        
                        </form>
                    </div>
                </div>
            </div> 
        </div>  
                

            <!-- Visuel du ticket de caisse-->

        <div class="container-fluid">
            <div class="row">
                <div class="col">
                    <!-- entête du ticket de caisse -->
                    <div class="container-fluid">
                        <div class="row m-2">
                            <div class="col">
                                <p class="entete-ticket">Nom du vendeur : <?=$_SESSION['nom']?></p>
                            </div>
                            <div class="col">
                                <!--information sur le nombre d'objets contenu dans le ticket de caisse temporaire, compte les entrées dans la table ticketdecaissetemp-->
                                <p class="entete-ticket"> Nombre d'objet : <?php
                                if(isset($NbrObjetDeTC)){
                                echo $NbrObjetDeTC;
                                }else{
                                    echo 0;        }
                                ?> 
                                </p>
                            </div>
                            <div class="col">
                                <p class="entete-ticket"> Prix Total : <?php
                                $getTotalEnEuros = $getTotal['prix_total']/100;
                                echo $getTotalEnEuros.'€';
                                ?> 
                                </p>
                            </div>
                        </div>
                    </div>                    

                    <!--Affichage en directe du future ticket de caisse-->
                    <div class="visu-tc">
                        <table class="tableau">
                            <tr class="ligne">
                                <th class="cellule_tete">Nom</th>
                                <th class="cellule_tete">Catégorie</th>
                                <th class="cellule_tete">Sous-Catégorie</th>
                                <th class="cellule_tete">Prix unit</th>
                                <th class="cellule_tete">Nbr</th>
                                <th class="cellule_tete">Prix</th>
                            </tr>
                        
                        <?php foreach($getObjets as list($id, $nom, $categorie, $souscat, $prix, $nombre, $prix_t)){
                            
                            $prixeuro = $prix/100;
                            if(isset($_GET['id_modif'])):
                                echo '<tr class="ligne">
                                
                                    
                                    <td class="colonne">'.$nom.'</td>
                                    <td class="colonne">'.$categorie.'</td>
                                    <td class="colonne">'.$souscat.'</td>
                                    <td class="colonne"><form method="post"><input type="text" style="width:40px" value="'.$prixeuro.'" name="prix">€<input type="hidden" value="'.$id.'" name="idobjet"><button type="submit" class="btn btn-primary btn-sm mt-1" name="modifprix">modif</button></form></td>
                                    <td class="colonne"><form method="post"><input type="text" style="width:40px" value="'.$nombre.'" name="nbr"><input type="hidden" value="'.$id.'" name="idobjet"><button type="submit" class="btn btn-primary btn-sm mt-1" name="modifnbr">modif</button></form></td>
                                    <td class="colonne">'.($prix_t/100).'€</td>
                                    <td class="colonne"><a href="actions/objets/supprObjetDeTC.php?id='.$id.'&id_temp_vente='.$_GET['id_temp_vente'].'&id_modif='.$_GET['id_modif'].'&modif='.$_GET['modif'].'">X</a></td>
                                    
                                    
                                    </tr>'  ;
                            else:
                                echo '<tr class="ligne">
                                
                                    
                                    <td class="colonne">'.$nom.'</td>
                                    <td class="colonne">'.$categorie.'</td>
                                    <td class="colonne">'.$souscat.'</td>
                                    <td class="colonne"><form method="post"><input type="text" style="width:40px" value="'.$prixeuro.'" name="prix">€<input type="hidden" value="'.$id.'" name="idobjet"><button type="submit" class="btn btn-primary btn-sm mt-1" name="modifprix">modif</button></form></td>
                                    <td class="colonne"><form method="post"><input type="text" style="width:40px" value="'.$nombre.'" name="nbr"><input type="hidden" value="'.$id.'" name="idobjet"><button type="submit" class="btn btn-primary btn-sm mt-1" name="modifnbr">modif</button></form></td>
                                    <td class="colonne">'.($prix_t/100).'€</td>
                                    <td class="colonne"><a href="actions/objets/supprObjetDeTC.php?id='.$id.'&id_temp_vente='.$_GET['id_temp_vente'].'&modif='.$_GET['modif'].'">X</a></td>
                                    
                                    
                                    </tr>'  ;
                            endif;
                        }
                        ?>
                        </table>
                    </div>

                    
                    
                    
                </div>
                <!-- Affichage des boutons de vente -->
                <div class="col-7">
                    <nav id="navbar-category" class="navbar bg-body-tertiary navbar-light bg-light px-3 d-none d-md-block d-lg-block d-xl-block d-xxl-block">
                        <ul class="nav nav-pills">    
                        <?php foreach($category as $k=>$v):?>
                            <?php foreach($v as $v1=>$v2):?>
                                <li class="nav-item">
                                    <a class="nav-link" href="#scrollspyHeading<?=$k?>">
                                    <?=$v2['category']?>
                                    </a>
                                </li>
                            <?php endforeach; ?>
                        <?php endforeach; ?>  
                        </ul>
                    </nav>
                    <div style="height:450px; overflow-y:scroll;" data-bs-spy="scroll" data-bs-target="#navbar-category" data-bs-offset="0" class="scrollspy-example d-none d-md-block d-lg-block d-xl-block d-xxl-block" tabindex="0">
                        <div style="height:5000px;">
                        <!-- On va chercher le nom des catégories dans le tableau $category de recupBoutonsCaisse.php -->
                        <?php foreach($category as $k=>$v):?>
                            <?php foreach($v as $v1=>$v2):?>
                            <h3 id="scrollspyHeading<?=$k?>"><?=$v2['category']?></h3>
                            <div class="container text-center ">
                                <?php 
                                //On affiche maintenant les boutons par sous catégories dans chaque catégorie, à l'aide du tableau bien arrangé dans recupBoutonsCaisse.php
                                foreach($newboutons[$k] as $key=>$value):
                                ?>
                                    <div class="row row-cols-5">
                                        <?php if($v2['category']==$key):?>
                                        
                                        <?php else:?>
                                        <p class="sous-cat"><?=$key?></p>
                                        <?php endif;?>
                                    </div>
                                    <div class="row row-cols-5">   
                                        <?php
                                        foreach($value as $value1=>$value2):
                                        ?>
                                        <!-- Les valeurs des couleurs sont définies dans styles.scss dans $custom-theme-colors -->
                                        <a class="col btn btn-<?=$value2['color']?> border-dark m-1 rounded-3" role="button" href="actions/objets/objetsVendusViaBoutonsAction.php?id_bouton=<?=$value2['id_bouton']?>&id_temp_vente=<?=$_GET['id_temp_vente']?><?php if(isset($_GET['id_modif'])):?>&id_modif=<?=$_GET['id_modif']?><?php endif;?>&modif=<?=$_GET['modif']?>"><?=$value2['nom']?></a>
                                        <?php 
                                        endforeach; 
                                        ?>
                                    </div>
                                <?php
                                endforeach;
                                ?>                           
                            </div>    
                            <?php endforeach; ?>                     
                        <?php endforeach; ?>  
                        </div>                    
                    </div>
                    <?php 
                    // Affichage des boutons carte/espece/cheque/mixte
                    if($NbrObjetDeTC > 0):
                        if(isset($_GET['id_modif'])):
                        ?>
                            <a class="btn btn-outline-primary btn-lg m-3" href="verif.php?prix=<?=$getTotalEnEuros?>&nbrObjet=<?=$NbrObjetDeTC?>&id_temp_vente=<?=$_GET['id_temp_vente']?>&id_modif=<?=$_GET['id_modif']?>&modif=<?=$_GET['modif']?>&mp=espèces" class="stdbouton">Espece</a>
                            <a class="btn btn-outline-secondary btn-lg m-3" href="verif.php?prix=<?=$getTotalEnEuros?>&nbrObjet=<?=$NbrObjetDeTC?>&id_temp_vente=<?=$_GET['id_temp_vente']?>&id_modif=<?=$_GET['id_modif']?>&modif=<?=$_GET['modif']?>&mp=carte" class="stdbouton">Carte</a>
                            <a class="btn btn-outline-warning btn-lg m-3" href="verif.php?prix=<?=$getTotalEnEuros?>&nbrObjet=<?=$NbrObjetDeTC?>&id_temp_vente=<?=$_GET['id_temp_vente']?>&id_modif=<?=$_GET['id_modif']?>&modif=<?=$_GET['modif']?>&mp=chèque" class="stdbouton">Chèque</a>
                            <a class="btn btn-outline-success btn-lg m-3" href="verif.php?prix=<?=$getTotalEnEuros?>&nbrObjet=<?=$NbrObjetDeTC?>&id_temp_vente=<?=$_GET['id_temp_vente']?>&id_modif=<?=$_GET['id_modif']?>&modif=<?=$_GET['modif']?>&mp=mixte" class="stdbouton">Mixte</a>  
                        <?php
                        else:
                        ?>
                            <a class="btn btn-outline-primary btn-lg m-3" href="verif.php?prix=<?=$getTotalEnEuros?>&nbrObjet=<?=$NbrObjetDeTC?>&id_temp_vente=<?=$_GET['id_temp_vente']?>&modif=<?=$_GET['modif']?>&mp=espèces" class="stdbouton">Espece</a>
                            <a class="btn btn-outline-secondary btn-lg m-3" href="verif.php?prix=<?=$getTotalEnEuros?>&nbrObjet=<?=$NbrObjetDeTC?>&id_temp_vente=<?=$_GET['id_temp_vente']?>&modif=<?=$_GET['modif']?>&mp=carte" class="stdbouton">Carte</a>
                            <a class="btn btn-outline-warning btn-lg m-3" href="verif.php?prix=<?=$getTotalEnEuros?>&nbrObjet=<?=$NbrObjetDeTC?>&id_temp_vente=<?=$_GET['id_temp_vente']?>&modif=<?=$_GET['modif']?>&mp=chèque" class="stdbouton">Chèque</a>
                            <a class="btn btn-outline-success btn-lg m-3" href="verif.php?prix=<?=$getTotalEnEuros?>&nbrObjet=<?=$NbrObjetDeTC?>&id_temp_vente=<?=$_GET['id_temp_vente']?>&modif=<?=$_GET['modif']?>&mp=mixte" class="stdbouton">Mixte</a>
                        <?php
                        endif;
                    endif;             
                    ?>
                    <?php
                    if($_GET['modif']==1):
                    ?>
                    <!-- Boutons annnuler ou annuler modif -->
                    <a class="btn btn-outline-danger btn-lg m-3" href="actions/objets/annulemodif.php?id_temp_vente=<?=$_GET['id_temp_vente']?>&id_modif=<?=$_GET['id_modif']?>" class="stdbouton">Annuler Modification </a>
                    
                    <?php
                    else:
                    ?>

                    <a class="btn btn-outline-danger btn-lg m-3" href="actions/objets/annulerVenteAction.php?id_temp_vente=<?=$_GET['id_temp_vente']?>" class="stdbouton">Annuler </a>
                    
                    <?php
                    endif;
                    ?>
                </div>
            </div>
        </div>
        

        <!-- Script Jquery pour dérouler des sous catégories à partir des catégories-->
        
        <script src="https://code.jquery.com/jquery-3.5.1.min.js" crossorigin="anonymous"></script>
        <script>
            $(document).ready(function() {
                $('#type1').on('change',function(){
                    var category_id = this.value;
                    $.ajax({
                        url:"actions/objets/get-subcat.php",
                        type:"POST",
                        data:{
                            category_id: category_id 
                        },
                        cache: false,
                        success: function(result){
                            $("#sub-category-dropdown1").html(result);
                        }
                    });
                });
            });
        </script>

        <script>
            $(document).ready(function() {
                $('#type2').on('change',function(){
                    var category_id = this.value;
                    $.ajax({
                        url:"actions/objets/get-subcat.php",
                        type:"POST",
                        data:{
                            category_id: category_id 
                        },
                        cache: false,
                        success: function(result){
                            $("#sub-category-dropdown2").html(result);
                        }
                    });
                });
            });
        </script>
        <!--Le script ci-dessous permet de récupérer la valeure de la catégorie pour la passer dans la page ajoutsouscat directement, évitant à l'utilisateur de saisir de nouveau la catégorie        -->
        <script>
            function getValue() {
            // Sélectionner l'élément input et récupérer sa valeur
            var input = document.getElementById("type").value;
            // Afficher la valeur
            document.location.href='ajoutsouscat.php?from=vente&id_temp_vente=<?=$_GET['id_temp_vente']?>&modif=<?=$_GET['modif']?><?php if(isset($_GET['id_modif'])): echo '&id_modif='.$_GET['id_modif'].''; endif;?>&cat='+input;
            }    
        </script>
       

        
        <?php
            }else{
                echo 'Vous n\'êtes pas administrateur, veuillez contacter le webmaster svp';
            }
            include('includes/footer.php');
            ?>
            
    </body>
</html>