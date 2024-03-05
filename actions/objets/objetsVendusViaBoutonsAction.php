<?php require('../db.php');
session_start();
?>

<?php


    
    //Pour vérifier si l'id du bouton est bien dans l'URL
    
    if(isset($_GET['id_bouton'])){
        
        $sql='SELECT * FROM boutons_ventes 
                INNER JOIN categories ON boutons_ventes.id_cat=categories.id
                WHERE id_bouton = '.$_GET['id_bouton'].'';
        $sth = $db->query($sql);
        $result = $sth->fetch();

            
            if(!empty($_GET['id_temp_vente'])){
                
                $id_temp_vente = $_GET['id_temp_vente'];
            
                
                //On récupère les données de l'objet
                
                $nom_objet = $result['nom'];
                $categorie_objet = $result['category'];
                $souscat = $result['sous_categorie'];
                
                //On récupère les données du vendeur
                
                $nomVendeur = $_SESSION['nom'];
                $idVendeur = $_SESSION['id'];
                $prixOfObjet = $result['prix'];
                $date_achat = date('d/m/Y');
                
                $nbr=1;
                $prixt=$nbr*$prixOfObjet;
            
                
                //On insère l'objet dans la db ticketdecaissetemp
                
                $insertObjetInTicket = $db -> prepare('INSERT INTO ticketdecaissetemp(id_temp_vente, nom_vendeur, id_vendeur, nom, categorie, souscat, prix, nbr, prixt) VALUES(?,?,?,?,?,?,?,?,?)');
                $insertObjetInTicket -> execute(array($id_temp_vente, $nomVendeur, $idVendeur, $nom_objet, $categorie_objet, $souscat, $prixOfObjet, $nbr, $prixt));
                
                
                //On redirige vers la page objets vendus.

                
                $id_temp_vente = $_GET['id_temp_vente'];

                if(isset($_GET['id_modif'])):
                    header('location:../../objetsVendus.php?id_temp_vente='.$id_temp_vente.'&id_modif='.$_GET['id_modif'].'&modif='.$_GET['modif'].'#tc');
                else:
                    header('location:../../objetsVendus.php?id_temp_vente='.$id_temp_vente.'&modif='.$_GET['modif'].'#tc');
                endif;
            }
            else{
                $message = 'Un problème est survenu concernant l\'id de la vente';
            }
        
    }
        
