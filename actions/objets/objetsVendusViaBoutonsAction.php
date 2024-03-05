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
        echo '<pre>';
        var_dump($result);
        echo '</pre>';

        /* STAGIAIRES -- Afin d'appliquer la réduction au prix de la table bouton caisse, il faut déjà récupérer les données de la table réduction, avec une requète SQL
        Ensuite, il va falloir comparer $result avec le tableau des données de la table reduction. 
        $result se presente de la forme 
        
        array(20) {
        ["id_bouton"]=>
        string(2) "21"
        [0]=>
        string(2) "21"
        ["sous_categorie"]=>
        string(23) "Matériel puériculture"
        [1]=>
        string(23) "Matériel puériculture"
        ["nom"]=>
        string(13) "Lit parapluie"
        [2]=>
        string(13) "Lit parapluie"
        ["id_cat"]=>
        string(1) "5"
        [3]=>
        string(1) "5"
        ["id_souscat"]=>
        string(2) "24"
        [4]=>
        string(2) "24"
        ["prix"]=>
        string(3) "700"
        [5]=>
        string(3) "700"
        ["id"]=>
        string(1) "5"
        [6]=>
        string(1) "5"
        ["parent_id"]=>
        string(6) "parent"
        [7]=>
        string(6) "parent"
        ["category"]=>
        string(7) "Enfants"
        [8]=>
        string(7) "Enfants"
        ["color"]=>
        string(7) "enfants"
        [9]=>
        string(7) "enfants"
        }

        S'il existe une réduction qui possède le meme numéro de categorie que l'objet qui a été cliqué, alors on récupère le montant de la réduction que l'on stocke dans une variable (si par exemple, le montant de la réduction est 20%, alors la variable en question sera de 1-0,2=0,8), sinon cette variable est 1 par défaut */    
            
            if(!empty($_GET['id_temp_vente'])){
                
                $id_temp_vente = $_GET['id_temp_vente'];
            
                
                //On récupère les données de l'objet
                
                $nom_objet = $result['nom'];
                $categorie_objet = $result['category'];
                $souscat = $result['sous_categorie'];
                
                //On récupère les données du vendeur
                
                $nomVendeur = $_SESSION['nom'];
                $idVendeur = $_SESSION['id'];
                $prixOfObjet = $result['prix'];//STAGIAIRES -- ici on modifie pour faire en sorte que le prix soit le bon;
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
        
