<?php
require('actions/users/securityAction.php');
require('actions/db.php');

$sql ='SELECT date, timestamp, nombre_vente, poids, prix_total, prix_total_espece, prix_total_cheque, prix_total_carte FROM bilan ORDER by timestamp DESC';
$sth = $db->query($sql);
$results=$sth->fetchAll();



?>

<!DOCTYPE HTML>

<html lang="fr-FR">
    <?php include("includes/head.php");?>
    <body class="corps">
        <?php
            $lineheight = "uneligne";
            $src = 'image/PictoFete.gif';
            $alt = 'un oiseau qui fait la fête.';
            $titre = 'Bilan des Tickets de caisse';
            include("includes/header.php");
            $page = 3;
            include("includes/nav.php");
            ?>
            
            
            <?php
            if($_SESSION['admin'] >= 1){
            ?>
            
            
            
        
        <table class="tableau">
            <tr class="ligne">
                <th class="cellule_tete">Date</th>
                <th class="cellule_tete">Nombre de vente</th>
                <th class="cellule_tete">Poids</th>
                <th class="cellule_tete">Recette Totale</th>
                <th class="cellule_tete">Espèces</th>
                <th class="cellule_tete">Chèques</th>
                <th class="cellule_tete">Carte</th>
                
            </tr>
        
        <?php foreach($results as list($date, $timestamp, $nombre, $poids, $total, $espece, $cheque, $carte)){
            
                        $poids = $poids/1000;
                        $total = $total/100;
                        $espece = $espece/100;
                        $cheque = $cheque/100;
                        $carte = $carte/100;
                        $format_us = implode('-',array_reverse  (explode('/',$date)));
        
                        echo '<tr class="ligne">
                        
                            
                            <td class="colonne">'.$date.'</td>
                            <td class="colonne">'.$nombre.'</td>
                            <td class="colonne">'.$poids.' kg</td>
                            <td class="colonne">'.$total.' €</td>
                            <td class="colonne">'.$espece.' €</td>
                            <td class="colonne">'.$cheque.' €</td>
                            <td class="colonne">'.$carte.' €</td>
                            <td class="colonne"><a href="actions/objets/update_db_bilan_manuel.php?date='.$date.'">Mise à jour</a></td>
                            
                            <td class="colonne"><a href="actions/objets/compiltxt.php?date='.$format_us.'">Compiler les tickets du jour</a></td>
                            
                            </tr>';
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