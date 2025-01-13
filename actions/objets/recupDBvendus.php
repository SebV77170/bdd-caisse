<?php require('actions/db.php'); ?>

<?php

if (isset($_GET['tri'])) {
    $tri = $_GET['tri'];
} else {
    $tri = 'categorie'; // Trier par défaut par catégorie
}

if (isset($_GET['order'])) {
    $order = $_GET['order'];
} else {
    $order = 'ASC'; // Ordre de tri par défaut (croissant)
}

if (isset($_GET['perPage'])) {
    $perPage = (int)$_GET['perPage'];
} else {
    $perPage = 50; // Nombre d'objets par page par défaut
}

if (isset($_GET['page'])) {
    $page = (int)$_GET['page'];
} else {
    $page = 1; // Page par défaut
}

$start = ($page - 1) * $perPage;

$query = 'SELECT nom, nom_vendeur, categorie, souscat, date_achat, timestamp, prix FROM objets_vendus';

if (isset($_GET['year']) && $_GET['year'] != 'all') {
    $year = (int)$_GET['year'];
    $query .= ' WHERE YEAR(date_achat) = '.$year;
}

$query .= ' ORDER BY '.$tri.' '.$order.' LIMIT '.$start.', '.$perPage;

$getAllObjets = $db->prepare($query);
$getAllObjets->execute();

$getObjets = $getAllObjets->fetchAll();

// Récupérer le nombre total d'objets pour la pagination
$countQuery = 'SELECT COUNT(*) FROM objets_vendus';
if (isset($_GET['year']) && $_GET['year'] != 'all') {
    $countQuery .= ' WHERE YEAR(date_achat) = '.$year;
}
$totalObjets = $db->query($countQuery)->fetchColumn();
$totalPages = ceil($totalObjets / $perPage);

?>
