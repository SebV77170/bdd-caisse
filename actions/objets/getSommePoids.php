<?php require('actions/db.php'); ?>

<?php

$touteLesSommes = $db -> prepare('SELECT categorie, SUM(poids) AS poids_total_par_cat FROM objets_collectes GROUP BY categorie');
$touteLesSommes -> execute();

$LesSommes = $touteLesSommes -> fetchAll();

if(!isset($where2)){
    $where2='';
}

if (isset($_GET['year']) && $_GET['year'] != 'all') {
    $year = (int)$_GET['year'];
    $where2 = 'WHERE YEAR(date) = '.$year;
}

$sommeTotale = $db -> prepare('SELECT SUM(poids) AS poids_total FROM objets_collectes '.$where2.'');
$sommeTotale->execute();

$poids_total_obj_collecte = $sommeTotale -> fetch();

?>
