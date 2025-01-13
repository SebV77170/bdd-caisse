<?php require('actions/db.php'); ?>

<?php

// Vérifie si un tri spécifique a été demandé, sinon utilise 'timestamp' par défaut
if (isset($_GET['tri'])) {
    $tri = $_GET['tri'];
} else {
    $tri = 'timestamp'; // Trier par défaut par date d'ajout (les plus récents)
}

// Vérifie si un ordre de tri spécifique a été demandé, sinon utilise 'DESC' par défaut
if (isset($_GET['order'])) {
    $order = $_GET['order'];
} else {
    $order = 'DESC'; // Ordre de tri par défaut (décroissant)
}

// Vérifie si un nombre d'objets par page spécifique a été demandé, sinon utilise 50 par défaut
if (isset($_GET['perPage'])) {
    $perPage = (int)$_GET['perPage'];
} else {
    $perPage = 50; // Nombre d'objets par page par défaut
}

// Vérifie si une page spécifique a été demandée, sinon utilise la page 1 par défaut
if (isset($_GET['page'])) {
    $page = (int)$_GET['page'];
} else {
    $page = 1; // Page par défaut
}

// Calcule l'index de départ pour la requête SQL en fonction de la page actuelle et du nombre d'objets par page
$start = ($page - 1) * $perPage;

// Prépare la requête SQL pour récupérer les objets collectés
$query = 'SELECT id, nom, categorie, souscat, poids, date, timestamp, flux, saisipar FROM objets_collectes';

// Ajoute une condition pour filtrer par année si une année spécifique a été demandée
if (isset($_GET['year']) && $_GET['year'] != 'all') {
    $year = (int)$_GET['year'];
    $query .= ' WHERE YEAR(date) = '.$year;
}

// Ajoute les conditions de tri et de limite à la requête SQL
$query .= ' ORDER BY '.$tri.' '.$order.' LIMIT '.$start.', '.$perPage;

// Exécute la requête SQL
$getAllObjets = $db->prepare($query);
$getAllObjets->execute();

// Récupère tous les objets collectés correspondant à la requête
$getObjets = $getAllObjets->fetchAll();

// Prépare une requête SQL pour compter le nombre total d'objets collectés
$countQuery = 'SELECT COUNT(*) FROM objets_collectes';
if (isset($_GET['year']) && $_GET['year'] != 'all') {
    $countQuery .= ' WHERE YEAR(date) = '.$year;
}

// Exécute la requête SQL pour compter le nombre total d'objets collectés
$totalObjets = $db->query($countQuery)->fetchColumn();

// Calcule le nombre total de pages nécessaires pour afficher tous les objets
$totalPages = ceil($totalObjets / $perPage);

?>
