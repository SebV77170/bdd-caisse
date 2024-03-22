<?php require('actions/db.php');
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;
require 'PHPMailer/src/Exception.php';
require 'PHPMailer/src/PHPMailer.php';
require 'PHPMailer/src/SMTP.php';
?>
<?php

        if(isset($_POST['validate'])){
            
            
            function securisation($donnees){
                $donnees = trim($donnees);
                $donnees = stripslashes($donnees);
                $donnees = strip_tags($donnees);
                return $donnees;
            }
            $mail = securisation($_POST['mail']);
    
            /*Pour vérifier la présence ou non de l'arobase et envoyer le mail*/
            
            if (isset($mail) AND !empty($mail))
            {
                
                $position_arobase = strpos($mail, '@');
                
                    if ($position_arobase === false){
                        $message = 'Attention, votre email n\'est pas valide, l\'adresse doit comporter un arobase, merci.';
                    }
                    else {
                            
                            $email = new PHPmailer();
                            $email->SMTPDebug = 0;
                            $email->IsSMTP();
                            $email->isHTML(true);
                            $email->SMTPAuth = true;
                            $email->Host='smtp.ouvaton.coop';
                            $email->Username = 'magasin@ressourcebrie.fr';
                            $email->Password = 'Magasin7#';
                            $email->SMTPSecure = 'ssl';
                            $email->Port = 465;
                            $email->From='magasin@ressourcebrie.fr'; 
                            $email->AddAddress($mail); 
                            $email->AddReplyTo('magasin@ressourcebrie.fr');      
                            $email->Subject='Votre ticket ou facture Ressource\'Brie'; 
                            $email->Body='<html><body class="corps"><center><font size=8>Merci pour vos achats et à bientôt :)</font><br></body></html>'; 
                            $email->AddAttachment($lien); 
                            
                    
                            if(!$email->Send()){
                              echo $email->ErrorInfo; 
                            }
                            else{     
                              echo 'Mail envoyé avec succès';
                            }
                            $email->SmtpClose();
                            unset($email);
                            
                            if(isset($_POST['ok'])){
                            
                            $insertMailDb = $db->prepare('INSERT INTO client (mail) VALUE (?)');
                            $insertMailDb->execute(array($mail));
                            }
                            
                            header('location: accueil_vente.php');
                        }
            }else{
                
                $message = 'Attention, votre email n\'est pas valide, l\'adresse doit comporter un arobase, merci.';
                
            }
        }    
        ?>