<?php 
    if(isset($_POST['validate_adresse'])):
        //met le contenu du ticket dans une variable
        $contenu_ticket = file_get_contents($lien);
        //crée le fichier facture
        $numfacture = $_GET['id_ticket'];
        $facture = fopen("factures/facture$numfacture.txt", 'c+b');

        if(!empty($_POST['raison']) AND !empty($_POST['adresse']) AND !empty($_POST['code_postal']) AND !empty($_POST['ville'])):

            //on écrit la facture avec l'adresse entrée par le caissier
            $raison = $_POST['raison'];
            $rue = $_POST['adresse'];
            $ville = $_POST['ville'];
            $code_postal = $_POST['code_postal'];
            $adresse = "\t $raison \r\t $rue \r\t $code_postal $ville\r\r";
            fwrite($facture,$adresse);
            fwrite($facture, $contenu_ticket);
            fclose($facture);

            //On insère dans le table facture
            $lien_facture = "factures/facture$numfacture.txt";
            $insert_param_facture = $db -> prepare('INSERT INTO facture (id_ticket,lien) VALUES (?,?)');
            $insert_param_facture -> execute(array($numfacture,$lien_facture));

            //On définit du coup la nouvelle variable $lien qui va s'afficher sur la page

            $lien = $lien_facture;

        else:
            $message1="Veuillez remplir tous les champs svp.";
        endif;
    endif;
