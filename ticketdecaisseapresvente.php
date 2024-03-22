<?php
require('actions/users/securityAction.php');
require('actions/objets/getTicket.php');
require('actions/objets/facturation.php');
require('actions/objets/envoieTicketAction.php');
?>

<!DOCTYPE HTML>

<html lang="fr-FR">
    <?php include("includes/head.php");?>
    <body class="corps">
        <?php
            $lineheight = "uneligne";
            $src = 'image/PictoFete.gif';
            $alt = 'un oiseau qui fait la fête.';
            $titre = 'Tickets de caisse';
            include("includes/header.php");
            $page = 3;
            include("includes/nav.php");
            ?>
            
            
            <?php
            if($_SESSION['admin'] >= 1){
            ?>
        
        
        <div id="ticket">
            <p class="paraph"><iframe src="<?php echo $lien;?>" frameborder=0 width=800 height=300></iframe></p>
        </div>
        
         <form method="post">
                
                <fieldset class="jeuchamp">
            
                    <label class="champ" for="mail">Email du client : </label>
                    <input class="input"type="text" name="mail">
                    
                    <label class="champ" for="ok">Inscription mailing (cochez si le client est ok)</label>
                    <input class="input"type="checkbox" name="ok">
            
                
                </fieldset>
                
                <?php if(isset($message)){
                ?>
                <p style='text-align: center; color: red;'>ATTENTION : <?=$message?></p>
                <?php
                }
                ?>
            
                <input type="submit" class="input inputsubmit" name="validate" value="Envoyer">
                
                
            </form>

            <form method="post">
                
                <fieldset class="jeuchamp">

                    <label class="champ" for="raison">Raison sociale : </label>
                    <input class="input" type="text" name="raison">
            
                    <label class="champ" for="adresse">Adresse : </label>
                    <input class="input" type="text" name="adresse">

                    <label class="champ" for="code_postal">Code postal : </label>
                    <input class="input" type="text" name="code_postal">

                    <label class="champ" for="ville">Ville : </label>
                    <input class="input" type="text" name="ville">

            
                </fieldset>

                <?php if(isset($message1)){
                ?>
                <p style='text-align: center; color: red;'>ATTENTION : <?=$message1?></p>
                <?php
                }
                ?>
            
                <input type="submit" class="input inputsubmit" name="validate_adresse" value="facture">
                
                
            </form>
        
        <a href='accueil_vente.php' class='stdbouton'>Retour</a>

        
        
        <?php
            }else{
                echo 'Vous n\'êtes pas administrateur, veuillez contacter le webmaster svp';
            }
            include('includes/footer.php');
            ?>
    </body>
</html>