<?php
require('actions/users/securityAction.php');
require('actions/objets/currencyToDecimalFct.php');
require('actions/objets/moyenDePaiementAction.php');
require('actions/objets/moyenDePaiementCarteAction.php');
require('actions/objets/moyenDePaiementChequeAction.php');
require('actions/objets/moyenDePaiementMixteAction.php');
require('actions/objets/moyenDePaiementMixteAction.php');
require('app/bootstrap.php');

//On insert dans le ticket de caisse temporaire la réduction de -5 ou -10€ lorsqu'on clique sur le bouton valider avec reduction
//Pour ce faire, on s'assure que ce script ne s'appliquera que lorsqu'on cliquera sur le bouton valider avec réduction, mais pas lorsqu'on appuiera sur le bouton valider final.
//On ne veut pas que la réduction soit de nouveau insérée dans la db ticketdecaissetemp une fois la validation finale.

if(isset($_GET['ra']) AND !isset($_POST['final-validation'])):
    
        if($_GET['ra']=='trueClient'):
            $prixOfObjet = -500;
            $nom_objet = 'reduction fid client';
            $categorie_objet = 'reduction fid client';
            $souscat = 'reduction fid client';
        elseif($_GET['ra']=='trueBene'):
            $prixOfObjet = -1000;
            $nom_objet = 'reduction fid bénévole';
            $categorie_objet = 'reduction fid bénévole';
            $souscat = 'reduction fid bénévole';
        elseif($_GET['ra']=='trueGrosPanierClient'):
            $prixOfObjet = -$_GET['delta_prix_client']*100;
            $nom_objet = 'reduction gros panier client';
            $categorie_objet = 'reduction gros panier client';
            $souscat = 'reduction gros panier client';
        elseif($_GET['ra']=='trueGrosPanierBene'):
            $prixOfObjet = -$_GET['delta_prix_bene']*100;
            $nom_objet = 'reduction gros panier bénévole';
            $categorie_objet = 'reduction gros panier bénévole';
            $souscat = 'reduction gros panier bénévole';
        elseif($_GET['ra']=='trueGrosPanierSansReduc'):
            $prixOfObjet = -$_GET['delta_prix']*100;
            $nom_objet = 'pas de reduction gros panier';
            $categorie_objet = 'pas de reduction gros panier';
            $souscat = 'pas de reduction gros panier';
        endif;
        $id_temp_vente = $_GET['id_temp_vente'];

        $nbr=1;
        $prixt=$nbr*$prixOfObjet;
        
        //On récupère les données du vendeur
        
        $nomVendeur = $_SESSION['nom'];
        $idVendeur = $_SESSION['id'];
        
        $date_achat = date('d/m/Y');
        $insertObjetInTicket = $db -> prepare('INSERT INTO ticketdecaissetemp(id_temp_vente, nom_vendeur, id_vendeur, nom, categorie, souscat, prix, nbr, prixt) VALUES(?,?,?,?,?,?,?,?,?)');
        $insertObjetInTicket -> execute(array($id_temp_vente, $nomVendeur, $idVendeur, $nom_objet, $categorie_objet, $souscat, $prixOfObjet, $nbr, $prixt));

endif;
?>

<!DOCTYPE HTML>

<html lang="fr-FR">
    <?php include("includes/head.php");?>
    <body class="corps">
        <?php
            $lineheight = "uneligne";
            $src = 'image/PictoFete.gif';
            $alt = 'un oiseau qui fait la fête.';
            $titre = 'Insérez le moyen de paiement';
            include("includes/header.php");
            $page = 2;
            include("includes/nav.php");
            ?>
            
            
            <div class='container-fluid'>
                <div class='row'>
                <?php
                if($_SESSION['admin'] >= 1){
                    if($_GET['prix']<50):
                        $nbrTampon = floor($_GET['prix']/5);
                    else:
                        $nbrTampon=0;
                    endif;

                    if(!isset($_GET['ra'])):
                ?>
                        <?php if($_GET['prix']>=50): ?>
                        <h2 style='text-align: center;'>Vous devez tamponner <?= $nbrTampon?> fois la carte de fidélité (la remise 'gros panier' n'est pas cumulable avec la carte de fidélité).</h2>
                        <?php else: ?>
                        <h2 style='text-align: center;'>Vous devez tamponner <?= $nbrTampon?> fois la carte de fidélité.</h2>
                        <?php endif;?>
                        <?php if($_GET['prix']<50): ?>
                        <h3 style='text-align: center;'>Si la carte est pleine, veuillez valider avec la remise (bénévole ou client) svp.</h3>
                        <?php endif;?>
                        <?php if($_GET['prix']>=50): ?>
                        <h3 style='text-align: center;'>Pour info, le panier fait plus de 50€, du coup on valide avec la remise 'gros panier'.</h3>
                        <?php endif;?>
                    <?php endif;
                    
                    if($_GET['prix']>=0):
                    ?>

                    <h2 style='text-align: center;'>Etes-vous certains de vouloir valider cette vente de <?= $_GET['prix']?> € en <?=$_GET['mp']?> ?</h2>
                    <?php 
                    else:
                    ?>
                    <h2 style='text-align: center;'>Etes-vous certains de vouloir valider cette vente de 0€ avec une réduction incomplète ?</h2>
                    <?php
                    endif;
                    ?>
                
                </div>
                <!-- Présentation des boutons valider, valider avec réduction client ou béné -->
                <div class='row text-center'>
                 
                <?php
                if(!isset($_GET['ra'])):
                    if($_GET['prix']<50):
                ?>
                <div class='col'>
                    <form method='get'>
                        <input type="hidden"  name="prix" value=<?=$_GET['prix']-5?>>
                        <input type="hidden"  name="nbrObjet" value=<?=$_GET['nbrObjet']?>>
                        <input type="hidden"  name="modif" value=<?=$_GET['modif']?>>
                        <input type="hidden"  name="id_temp_vente" value=<?=$_GET['id_temp_vente']?>>
                        <input type="hidden"  name="mp" value=<?=$_GET['mp']?>>
                        <?php if(isset($_GET['id_modif'])):?>
                        <input type="hidden"  name="id_modif" value=<?=$_GET['id_modif']?>>
                        <?php endif; ?>
                        <button type="submit" class="btn btn-warning m-2" name="ra" value="trueClient">valider avec réduction client</button>
                    </form>
                </div>
                <?php
                    endif;
                endif;
                ?>
            
                <?php 
                if(!isset($_GET['etape_de_validation'])):
                    if($_GET['prix']<50): ?>
                    <div class='col'>
                        <form method="post">
                        
                            <?php if(($_GET['mp'])=='espèces'):?>
                            <input type="hidden"  name="final-validation" value='ok'>
                            <input type="submit" class="btn btn-success" name="validateespece" <?php if(!isset($_GET['ra'])): ?> value="Valider sans remise" <?php else:?> value="Valider" <?php endif;?>>

                            <?php elseif(($_GET['mp'])=='carte'):?>
                            <input type="hidden"  name="final-validation" value='ok'>
                            <input type="submit" class="btn btn-success" name="validatecarte" <?php if(!isset($_GET['ra'])): ?> value="Valider sans remise" <?php else:?> value="Valider" <?php endif;?>>

                            <?php elseif(($_GET['mp'])=='chèque'):?>
                            <input type="hidden"  name="final-validation" value='ok'>
                            <input type="submit" class="btn btn-success" name="validatecheque" <?php if(!isset($_GET['ra'])): ?> value="Valider sans remise" <?php else:?> value="Valider" <?php endif;?>>

                            <?php elseif(($_GET['mp'])=='mixte'):?>
                            <h2 style='text-align: center;'>Comment répartissez-vous les dépenses ?</h2>
                            <fieldset class="jeuchamp">
                                <label class="champ" for="espece">Montant en espèce : </label>
                                <input class="input"type="text" name="espece">
                                
                                <label class="champ" for="carte">Montant en carte : </label>
                                <input class="input"type="text" name="carte">
                                
                                <label class="champ" for="cheque">Montant en chèque : </label>
                                <input class="input"type="text" name="cheque">

                                <input type="hidden"  name="final-validation" value='ok'>
                                <input type="submit" class="btn btn-success" name="validatemixte" <?php if(!isset($_GET['ra'])): ?> value="Valider sans remise" <?php else:?> value="Valider" <?php endif;?>>
                            </fieldset>
                            <?php endif;?>

                            <?php if(isset($message)):?>
                            <div class="alert alert-danger" role="alert">
                            <?=$message?>
                            </div>
                            <?php endif;?>
                        </form>
                    </div>
                <?php 
                    endif;
                else:
                ?>
                <div class='col'>
                    <form method="post">
                    
                        <?php if(($_GET['mp'])=='espèces'):?>
                        <input type="hidden"  name="final-validation" value='ok'>
                        <input type="submit" class="btn btn-success" name="validateespece" <?php if(!isset($_GET['ra'])): ?> value="Valider sans remise" <?php else:?> value="Valider" <?php endif;?>>

                        <?php elseif(($_GET['mp'])=='carte'):?>
                        <input type="hidden"  name="final-validation" value='ok'>
                        <input type="submit" class="btn btn-success" name="validatecarte" <?php if(!isset($_GET['ra'])): ?> value="Valider sans remise" <?php else:?> value="Valider" <?php endif;?>>

                        <?php elseif(($_GET['mp'])=='chèque'):?>
                        <input type="hidden"  name="final-validation" value='ok'>
                        <input type="submit" class="btn btn-success" name="validatecheque" <?php if(!isset($_GET['ra'])): ?> value="Valider sans remise" <?php else:?> value="Valider" <?php endif;?>>

                        <?php elseif(($_GET['mp'])=='mixte'):?>
                        <h2 style='text-align: center;'>Comment répartissez-vous les dépenses ?</h2>
                        <fieldset class="jeuchamp">
                            <label class="champ" for="espece">Montant en espèce : </label>
                            <input class="input"type="text" name="espece">
                            
                            <label class="champ" for="carte">Montant en carte : </label>
                            <input class="input"type="text" name="carte">
                            
                            <label class="champ" for="cheque">Montant en chèque : </label>
                            <input class="input"type="text" name="cheque">

                            <input type="hidden"  name="final-validation" value='ok'>
                            <input type="submit" class="btn btn-success" name="validatemixte" <?php if(!isset($_GET['ra'])): ?> value="Valider sans remise" <?php else:?> value="Valider" <?php endif;?>>
                        </fieldset>
                        <?php endif;?>

                        <?php if(isset($message)):?>
                        <div class="alert alert-danger" role="alert">
                        <?=$message?>
                        </div>
                        <?php endif;?>
                    </form>
                </div>
                <?php
                endif; ?>
                <?php
                if(!isset($_GET['ra'])):
                    if($_GET['prix']>=50):
                ?>
                    <!-- Affichage des deux boutons pour valider la réduction gros panier client ou bénévole (pas le même taux, 10% pour l'un, 20% pour l'autre        -->
                    <div class='col'>
                        <form method='get'>
                            <input type="hidden"  name="prix" value=<?=round($_GET['prix']*0.9,1,PHP_ROUND_HALF_UP)?>>
                            <input type="hidden"  name="delta_prix_client" value=<?=round($_GET['prix']*0.1,1,PHP_ROUND_HALF_UP)?>>                      
                            <input type="hidden"  name="nbrObjet" value=<?=$_GET['nbrObjet']?>>
                            <input type="hidden"  name="modif" value=<?=$_GET['modif']?>>
                            <input type="hidden"  name="id_temp_vente" value=<?=$_GET['id_temp_vente']?>>
                            <input type="hidden"  name="mp" value=<?=$_GET['mp']?>>
                            <input type="hidden"  name="etape_de_validation" value=2>
                            <?php if(isset($_GET['id_modif'])):?>
                            <input type="hidden"  name="id_modif" value=<?=$_GET['id_modif']?>>
                            <?php endif; ?>
                            <button type="submit" class="btn btn-warning m-2" name="ra" value="trueGrosPanierClient">valider avec réduction 'gros panier' CLIENT</button>
                        </form>
                        <form method='get'>
                            <input type="hidden"  name="prix" value=<?=round($_GET['prix']*0.8,1,PHP_ROUND_HALF_UP)?>>
                            <input type="hidden"  name="delta_prix_bene" value=<?=round($_GET['prix']*0.2,1,PHP_ROUND_HALF_UP)?>>                            
                            <input type="hidden"  name="nbrObjet" value=<?=$_GET['nbrObjet']?>>
                            <input type="hidden"  name="modif" value=<?=$_GET['modif']?>>
                            <input type="hidden"  name="id_temp_vente" value=<?=$_GET['id_temp_vente']?>>
                            <input type="hidden"  name="mp" value=<?=$_GET['mp']?>>
                            <input type="hidden"  name="etape_de_validation" value=2>
                            <?php if(isset($_GET['id_modif'])):?>
                            <input type="hidden"  name="id_modif" value=<?=$_GET['id_modif']?>>
                            <?php endif; ?>
                            <button type="submit" class="btn btn-warning m-2" name="ra" value="trueGrosPanierBene">valider avec réduction 'gros panier' BENEVOLE</button>
                        </form>
                        <form method='get'>
                            <input type="hidden"  name="prix" value=<?=$_GET['prix']?>>
                            <input type="hidden"  name="delta_prix" value="0">                            
                            <input type="hidden"  name="nbrObjet" value=<?=$_GET['nbrObjet']?>>
                            <input type="hidden"  name="modif" value=<?=$_GET['modif']?>>
                            <input type="hidden"  name="id_temp_vente" value=<?=$_GET['id_temp_vente']?>>
                            <input type="hidden"  name="mp" value=<?=$_GET['mp']?>>
                            <input type="hidden"  name="etape_de_validation" value=2>
                            <?php if(isset($_GET['id_modif'])):?>
                            <input type="hidden"  name="id_modif" value=<?=$_GET['id_modif']?>>
                            <?php endif; ?>
                            <button type="submit" class="btn btn-warning m-2" name="ra" value="trueGrosPanierSansReduc">valider sans aucune réduction 'gros panier'</button>
                        </form>
                    </div>
                <?php endif;?>
                <?php if($_GET['prix']<50): ?>
                <div class='col'>
                    <form method='get'>
                        <input type="hidden"  name="prix" value=<?=$_GET['prix']-10?>>
                        <input type="hidden"  name="nbrObjet" value=<?=$_GET['nbrObjet']?>>
                        <input type="hidden"  name="modif" value=<?=$_GET['modif']?>>
                        <input type="hidden"  name="id_temp_vente" value=<?=$_GET['id_temp_vente']?>>
                        <input type="hidden"  name="mp" value=<?=$_GET['mp']?>>
                        <?php if(isset($_GET['id_modif'])):?>
                        <input type="hidden"  name="id_modif" value=<?=$_GET['id_modif']?>>
                        <?php endif; ?>
                        <button type="submit" class="btn btn-warning m-2" name="ra" value="trueBene">valider avec réduction bénévole</button>
                    </form>
                </div>
                <?php
                    endif;
                endif;
                ?>
                </div>   
                <!-- Présentation du bouton retour -->
                <div class="row">
                    <div class="col">                     

                
                            <?php
                            if(isset($_GET['id_modif'])):
                            ?>
                                <a href="objetsVendus.php?id_temp_vente=<?=$_GET['id_temp_vente']?>&id_modif=<?=$_GET['id_modif']?>&modif=<?=$_GET['modif']?>#tc" class="stdbouton">Retour</a>
                            <?php
                            else:
                            ?>
                                <a href="objetsVendus.php?id_temp_vente=<?=$_GET['id_temp_vente']?>&modif=<?=$_GET['modif']?>#tc" class="stdbouton">Retour</a>
                            <?php
                            endif;
                            ?>
                        
                    </div>
                        
                
            </div>


   


        
       
        
        
        <?php
            }else{
                echo 'Vous n\'êtes pas administrateur, veuillez contacter le webmaster svp';
            }
            include('includes/footer.php');
            ?>
    </body>
</html>