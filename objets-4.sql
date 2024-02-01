-- phpMyAdmin SQL Dump
-- version 5.1.0
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost:8889
-- Généré le : jeu. 01 fév. 2024 à 13:22
-- Version du serveur :  5.7.34
-- Version de PHP : 8.0.8

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `objets`
--

-- --------------------------------------------------------

--
-- Structure de la table `bilan`
--

CREATE TABLE `bilan` (
  `id` int(11) NOT NULL,
  `date` varchar(255) NOT NULL,
  `Timestamp` int(11) NOT NULL,
  `nombre_vente` int(11) NOT NULL,
  `poids` int(11) NOT NULL,
  `prix_total` int(11) NOT NULL,
  `prix_total_espece` int(11) NOT NULL,
  `prix_total_cheque` int(11) NOT NULL,
  `prix_total_carte` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Structure de la table `boutons_ventes`
--

CREATE TABLE `boutons_ventes` (
  `id_bouton` int(11) NOT NULL,
  `sous_categorie` varchar(34) DEFAULT NULL,
  `nom` varchar(66) DEFAULT NULL,
  `id_cat` varchar(6) DEFAULT NULL,
  `id_souscat` int(11) DEFAULT NULL,
  `prix` varchar(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `boutons_ventes`
--

INSERT INTO `boutons_ventes` (`id_bouton`, `sous_categorie`, `nom`, `id_cat`, `id_souscat`, `prix`) VALUES
(2, 'Jeux-Jouets', 'Petits jouets (figurines, petites voitures, petits poneys)', '5', 26, '50'),
(3, 'Livres', 'Livre (petit modèle)', '5', 25, '50'),
(4, 'Jeux-Jouets', 'Puzzle < à 20 pièces', '5', 26, '100'),
(5, 'Peluches', 'Peluche (petit modèle)', '5', 26, '100'),
(6, 'Jeux-Jouets', 'Légos / Playmobiles (les 10)', '5', 26, '200'),
(7, 'Jeux-Jouets', 'Puzzle 20 à 100 pièces', '5', 26, '200'),
(8, 'Jeux-Jouets', 'Jeu de construction', '5', 26, '200'),
(9, 'Jeux-Jouets', 'Poupée', '5', 26, '200'),
(10, 'Jeux-Jouets', 'Puzzle > 100 pièces', '5', 26, '300'),
(11, 'Jeux-Jouets', 'Jouet éveil électronique', '5', 26, '500'),
(12, 'Jeux-Jouets', 'Gros jouets', '5', 26, '700'),
(13, 'Matériel puériculture', 'Assiettes bébé', '5', 24, '100'),
(14, 'Matériel puériculture', 'Coussin à langer', '5', 24, '200'),
(15, 'Matériel puériculture', 'Baignoire', '5', 24, '300'),
(16, 'Matériel puériculture', 'Tour de lit', '5', 24, '300'),
(17, 'Matériel puériculture', 'Table à langer', '5', 24, '500'),
(18, 'Matériel puériculture', 'Transat', '5', 24, '500'),
(19, 'Jeux-Jouets', 'Trottinette, draisienne, petite vélo, voiture enfant', '5', 26, '500'),
(20, 'Matériel puériculture', 'Chaise haute', '5', 24, '600'),
(21, 'Matériel puériculture', 'Lit parapluie', '5', 24, '700'),
(22, 'Matériel puériculture', 'Siège auto', '5', 24, '900'),
(23, 'Matériel puériculture', 'Lit à barreaux', '5', 24, '1000'),
(25, 'Vêtements', 'Collant', '5', 23, '50'),
(26, 'Vêtements', 'Chapeau', '5', 23, '50'),
(27, 'Vêtements', 'Body', '5', 23, '50'),
(28, 'Vêtements', 'Chaussons', '5', 23, '100'),
(29, 'Vêtements', 'Legging', '5', 23, '100'),
(30, 'Vêtements', 'Tee-shirt', '5', 23, '100'),
(31, 'Vêtements', 'Short', '5', 23, '100'),
(32, 'Vêtements', 'Pyjama', '5', 23, '100'),
(33, 'Vêtements', 'Maillot de bain', '5', 23, '100'),
(34, 'Vêtements', 'Déguisement', '5', 23, '150'),
(35, 'Vêtements', 'Jupe / Robe', '5', 23, '200'),
(36, 'Vêtements', 'Pantalon', '5', 23, '200'),
(37, 'Vêtements', 'Pull', '5', 23, '200'),
(38, 'Vêtements', 'Gigoteuse / Turbulette', '5', 23, '200'),
(39, 'Vêtements', 'Chaussures', '5', 23, '300'),
(40, 'Vêtements', 'Blouson', '5', 23, '400'),
(41, 'Vêtements', 'Manteau', '5', 23, '500'),
(43, 'Petit outillage', 'Petit outillage manuel (tournevis, clés…)', '7', 31, '100'),
(44, 'Petit outillage', 'Petit outillage voiture', '7', 31, '200'),
(45, 'Auto/moto', 'Tapis voiture', '7', 31, '400'),
(46, 'Petit outillage', 'Caisse à outils', '7', 31, '400'),
(47, 'Electroportatif', 'Petit outillage électrique (perçeuse…)', '7', 31, '1000'),
(48, 'Mobilier outillage', 'Servante', '7', 31, '1500'),
(49, 'Outils jardin', 'Tondeuse', '7', 31, '2000'),
(51, 'Auto/moto', 'Support téléphone voiture', '7', 31, '200'),
(52, 'Auto/moto', 'Béquilles', '7', 33, '300'),
(53, 'Musique', 'Housse de guitare', '7', 33, '500'),
(54, 'Sport', 'Putching ball', '7', 33, '800'),
(56, 'Livres', 'Livre de poche', '4', 21, '50'),
(57, 'Livres', 'Livre broché', '4', 21, '100'),
(58, 'Livres', 'Bande-dessinée', '4', 21, '100'),
(59, 'Disques', 'CD', '4', 21, '100'),
(60, 'Disques', 'DVD', '4', 21, '100'),
(61, 'Disques', 'Vinyle', '4', 21, '200'),
(62, 'Disques', 'Jeu vidéo', '4', 21, '300'),
(64, 'support à linge de maison', 'Tringles à rideaux', '1', 1, '100'),
(65, 'Assise', 'Chaise', '1', 1, '400'),
(66, 'Assise', 'Fauteuil, rocking chair', '1', 1, '1000'),
(67, 'Petit mobilier', 'Petit mobilier (table de chevet…)', '1', 1, '1000'),
(68, 'Table', 'Table basse', '1', 1, '2000'),
(69, 'Table', 'Bureau', '1', 1, '2000'),
(70, 'Table', 'Table de salle à manger', '1', 1, '3000'),
(71, 'Armoire', 'Armoire, buffet', '1', 1, '4000'),
(73, 'Vaisselle', 'Couteau / Fourchette / Cuillère', '6', 28, '50'),
(74, 'Vaisselle', 'Petit verre', '6', 28, '50'),
(75, 'Vaisselle', 'Assiette', '6', 28, '100'),
(76, 'Vaisselle', 'Verre à pied', '6', 28, '100'),
(77, 'Vaisselle', 'Bol', '6', 28, '100'),
(78, 'Vaisselle', 'Tasse', '6', 28, '150'),
(79, 'Vaisselle', 'Flûte à champagne', '6', 28, '150'),
(80, 'Vaisselle', 'Saladier', '6', 28, '200'),
(81, 'Vaisselle', 'Ensemble louche / écumoir', '6', 28, '200'),
(82, 'Vaisselle', 'Poêle, casserole', '6', 28, '300'),
(84, 'Bijoux', 'Bijoux fantaisie', '3', 86, '100'),
(85, 'Vêtements', 'Echarpe / Foulard/Cravate', '3', 19, '200'),
(86, 'Vêtements', 'Tee-shirt', '3', 19, '200'),
(87, 'Vêtements', 'Short', '3', 19, '200'),
(88, 'Vêtements', 'Pyjama', '3', 19, '200'),
(89, 'Vêtements', 'Chemise', '3', 19, '300'),
(90, 'Vêtements', 'Pull', '3', 19, '300'),
(91, 'Vêtements', 'Pantalon', '3', 19, '300'),
(92, 'Vêtements', 'Jupe', '3', 19, '300'),
(93, 'Vêtements', 'Sac à main (petit modèle)', '3', 19, '300'),
(94, 'Vêtements', 'Robe', '3', 19, '400'),
(95, 'Vêtements', 'Veste / Gilet', '3', 19, '400'),
(96, 'Vêtements', 'Vêtement ski', '3', 19, '400'),
(97, 'Vêtements', 'Chaussures', '3', 19, '500'),
(98, 'Sacs', 'Sac à main (grand modèle)', '3', 19, '500'),
(99, 'Sacs', 'Sac à dos randonnée ou de voyage', '3', 19, '500'),
(100, 'Vêtements', 'Manteau', '3', 19, '800'),
(101, 'Vêtements', 'Costume', '3', 19, '1500'),
(103, 'Linge de maison', 'Serviette de table', '3', 20, '50'),
(104, 'Linge de maison', 'Taie d\'oreiller', '3', 20, '100'),
(107, 'Linge de maison', 'Nappe', '3', 20, '150'),
(108, 'Linge de maison', 'Rideaux', '3', 20, '200'),
(109, 'Linge de maison', 'Drap', '3', 20, '300'),
(110, 'Linge de maison', 'Housse de couette', '3', 20, '400'),
(111, 'Linge de maison', 'Dessus de lit', '3', 20, '400'),
(112, 'Linge de maison', 'Couette (petit modèle)', '3', 20, '400'),
(113, 'Linge de maison', 'Couette (grand modèle)', '3', 20, '600'),
(115, 'Décoration', 'Jardinière plastique', '6', 30, '50'),
(116, 'Décoration', 'Cadre photo', '6', 30, '100'),
(117, 'Décoration', 'Boîtes plastiques et métal', '6', 30, '100'),
(118, 'Décoration', 'Petite décoration (bibelots, bougeoirs…)', '6', 30, '150'),
(119, 'Décoration', 'Pots / Vases', '6', 30, '200'),
(120, 'Décoration', 'Guirlande', '6', 30, '200'),
(121, 'Décoration', 'Tableau', '6', 30, '300'),
(122, 'Décoration', 'Lampes (à poser, plafonnier, abat-jour)', '6', 30, '300'),
(123, 'Décoration', 'Boîtes (ancienne, à couture…)', '6', 30, '400'),
(124, 'Décoration', 'Grande décoration (globe…)', '6', 30, '400'),
(125, 'Décoration', 'Lampe sur pied', '6', 30, '600'),
(127, 'Petit électro-ménager', 'Petits appareils électriques (réveil…)', '2', 2, '300'),
(128, 'Petit électro-ménager', 'Bouilloire', '2', 2, '400'),
(129, 'Petit électro-ménager', 'Cafetière filtre', '2', 2, '400'),
(130, 'Petit électro-ménager', 'Mixeur', '2', 2, '400'),
(131, 'Divertissement', 'Appareil de sport', '7', 33, '500'),
(132, 'Hifi', 'Magnétoscope', '2', 2, '600'),
(133, 'Petit électro-ménager', 'Micro-ondes', '2', 2, '700'),
(134, 'Hifi', 'Enceinte nomade connectée', '2', 2, '800'),
(135, 'Hifi', 'Lecteur DVD - Blue Ray', '2', 2, '800'),
(136, 'Divertissement', 'Appareil photo numérique compact', '2', 2, '1000'),
(137, 'Petit électro-ménager', 'Cafetière à dosettes', '2', 2, '1000'),
(138, 'Divertissement', 'Game boy', '2', 2, '1200'),
(139, 'Petit électro-ménager', 'Gros appareils électriques (machine à pain / raclette / crêpes)', '2', 2, '1200'),
(140, 'Divertissement', 'Smartphone', '2', 2, '1500'),
(142, 'TV', 'Télévision tube cathodique', '2', 2, '1500'),
(143, 'Hifi', 'Chaîne Hifi', '2', 2, '1800'),
(144, 'Divertissement', 'Tablette', '2', 2, '1800'),
(145, 'Divertissement', 'Vélo d\'appartement', '7', 33, '2000'),
(146, 'TV', 'Télévision écran plat, petit format', '2', 2, '2500'),
(147, 'Petit électro-ménager', 'Robot pâtissier', '2', 2, '3000'),
(148, 'Petit électro-ménager', 'Barbecue', '2', 2, '3000'),
(149, 'Divertissement', 'Home cinéma', '2', 2, '4000'),
(150, 'Divertissement', 'Playstation / X-Box  /Switch', '2', 2, '4000'),
(151, 'Petit électro-ménager', 'Centrale vapeur', '2', 2, '1000'),
(152, 'Linge de maison', 'Serviette de bain', '3', 20, '200'),
(153, 'Linge de maison', 'Gant de toilette', '3', 20, '50'),
(154, 'Linge de maison', 'Coussin / Coussin chaise', '3', 20, '100'),
(155, 'Vêtements', 'Ceinture', '3', 19, '200'),
(156, 'Sacs', 'Valise', '3', 19, '700'),
(157, 'Matériel puériculture', 'Poussette', '5', 24, '700'),
(158, 'Matériel puériculture', 'Tapis d\'éveil', '5', 24, '300'),
(159, 'Jeux-Jouets', 'Vélo (grand modèle)', '5', 26, '1000'),
(160, 'Jeux-Jouets', 'Petits jouets', '5', 26, '100'),
(161, 'Livres', 'Livre (grand modèle)', '5', 25, '100'),
(162, 'Livres', 'Bande-dessinée', '5', 25, '100'),
(163, 'Peluches', 'Peluche (grand modèle)', '5', 26, '200'),
(164, 'Décoration', 'Tapis (petit modèle)', '6', 30, '500'),
(165, 'Décoration', 'Tapis (grand modèle)', '6', 30, '800'),
(166, 'Décoration', 'Bougie', '6', 30, '50'),
(167, 'Sac', 'Cartable', '80', 80, '400'),
(168, 'Classement', 'Casier de rangement', '80', 80, '50'),
(169, 'Classement', 'Classeur (grand modèle)', '80', 80, '100'),
(170, 'Classement', 'Classeur (petit modèle)', '80', 80, '50'),
(171, 'Matériel divers', 'Compas', '80', 80, '50'),
(172, 'Matériel divers', 'Equerre', '80', 80, '50'),
(173, 'Classement', 'Pochettes élastiques', '80', 80, '20'),
(174, 'Classement', 'Pochettes feuilles plastiques (lutin)', '80', 80, '100'),
(175, 'Matériel divers', 'Rapporteur', '80', 80, '50'),
(176, 'Matériel divers', 'Règle', '80', 80, '50'),
(177, 'Matériel divers', 'Stylo BIC', '80', 80, '10'),
(178, 'Matériel divers', 'Stylo 4 couleurs', '80', 80, '50'),
(179, 'Classement', 'Trieur (petit modèle)', '80', 80, '100'),
(180, 'Classement', 'Trieur (grand modèle)', '80', 80, '200'),
(181, 'Matériel divers', 'Trousse', '80', 80, '100'),
(190, 'Matériel Puériculture', 'Autre', '5', 24, '0'),
(192, 'Livres', 'Autre', '5', 25, '0'),
(193, 'Vêtements', 'Autre', '5', 23, '0'),
(194, 'Jeux-Jouets', 'Autre', '5', 26, '0'),
(195, 'Vêtements', 'Autre', '3', 19, '0'),
(196, 'Linge de maison', 'Autre', '3', 20, '0'),
(197, 'Décoration', 'Autre', '6', 30, '0'),
(198, 'Vaisselle', 'Autre', '6', 28, '0'),
(199, 'Matériel divers', 'Autre', '80', 80, '0'),
(203, 'Outils de bricolage', 'Autre', '7', 31, '0'),
(204, 'Vaisselle', 'Grand ustensile', '6', 28, '200'),
(205, 'Bijoux', 'Montre', '3', 86, '300'),
(206, 'Vêtements', 'Chaussons', '3', 19, '100'),
(207, 'Jeux-Jouets', 'Jeu de société', '5', 26, '300'),
(208, 'Bijoux', 'Autre', '3', 86, '0'),
(209, 'Livres', 'Autre', '4', 21, '0'),
(210, 'Mobilier', 'Autre', '1', 1, '0'),
(211, 'Divertissement', 'Autre', '2', 2, '0'),
(212, 'Divertissement', 'Autre', '7', 33, '0');

-- --------------------------------------------------------

--
-- Structure de la table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `parent_id` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `color` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `categories`
--

INSERT INTO `categories` (`id`, `parent_id`, `category`, `color`) VALUES
(1, 'parent', 'Mobilier', 'mobilier'),
(2, 'parent', 'Appareils électriques', 'appareils-electrique'),
(3, 'parent', 'Vêtements adultes et linge de maison', 'vetements-adulte'),
(4, 'parent', 'Livres adultes', 'livres-adultes'),
(5, 'parent', 'Enfants', 'enfants'),
(6, 'parent', 'Vaisselle Décoration', 'vaisselle'),
(7, 'parent', 'Bricolage Jardinage Hobbies', 'bricolage'),
(8, 'parent', 'autre', ''),
(9, 'Mobilier', 'Bibliothèque', ''),
(10, 'Mobilier', 'Armoire', ''),
(11, 'Mobilier', 'Commode', ''),
(12, 'Mobilier', 'Table de chevet', ''),
(13, 'Mobilier', 'Meuble TV', ''),
(14, 'Mobilier', 'Lit', ''),
(15, 'Appareils électriques', 'TV', ''),
(16, 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', ''),
(17, 'Appareils électriques', 'Hifi', ''),
(18, 'Appareils électriques', 'Divertissement (Console...)', ''),
(19, 'Vêtements adultes et linge de maison', 'Vêtements', 'vetements-adulte'),
(20, 'Vêtements adultes et linge de maison', 'Linge de maison', 'linge-de-maison'),
(21, 'Livres adultes', 'Livres', 'livres-adultes'),
(22, 'Livres adultes', 'CD/DVD', ''),
(23, 'Enfants', 'Vêtements', 'vetements-enfants'),
(24, 'Enfants', 'Matériel puériculture', 'puericulture'),
(25, 'Enfants', 'Livres', 'livres-enfants'),
(26, 'Enfants', 'Jeux-Jouets', 'jouets'),
(27, 'Enfants', 'Peluches', ''),
(28, 'Vaisselle Décoration', 'Vaisselle', 'vaisselle'),
(29, 'Vaisselle Décoration', 'Ustensile de cuisine', ''),
(30, 'Vaisselle Décoration', 'Décoration diverse', 'decoration'),
(31, 'Bricolage Jardinage Hobbies', 'Outils de bricolage', 'Outils-de-bricolage'),
(32, 'Bricolage Jardinage Hobbies', 'Outils de jardinage', ''),
(33, 'Bricolage Jardinage Hobbies', 'Divers Hobbies', 'divers-hobby'),
(34, 'Bricolage Jardinage Hobbies', 'Outils pour le vélo', ''),
(35, 'Bricolage Jardinage Hobbies', 'Instruments de musique', ''),
(36, 'Livres adultes', 'Vinyles', ''),
(39, 'autre', 'Vente pour activités annexes', ''),
(40, 'Mobilier', 'Autres', ''),
(41, 'Vaisselle Décoration', 'Luminaire', ''),
(42, 'Mobilier', 'Sièges ', ''),
(44, 'Vêtements adultes et linge de maison', 'Sacs, valises...', ''),
(45, 'Vêtements adultes et linge de maison', 'Chaussures', ''),
(46, 'Appareils électriques', 'Ordi et matériel allant avec', ''),
(47, 'Vêtements adultes et linge de maison', 'Bijou ', ''),
(48, 'Mobilier', 'Petite table', ''),
(49, 'Enfants', 'Chaise enfant propreté ', ''),
(50, 'Vêtements adultes et linge de maison', 'Bijoux', ''),
(53, 'Mobilier', 'Essai', ''),
(54, 'Livres adultes', 'Romans ', ''),
(55, 'autre', 'Sacs', ''),
(56, 'autre', 'Parfums, accessoires toilette ...', ''),
(57, 'autre', 'articles scolaires', ''),
(58, 'Bricolage Jardinage Hobbies', 'Jeux', ''),
(59, 'Bricolage Jardinage Hobbies', 'Accessoires voiture ', ''),
(60, 'autre', 'Animaux ', ''),
(61, 'autre', 'Outils', ''),
(62, 'autre', 'Outils', ''),
(63, 'autre', 'Outils', ''),
(64, 'autre', 'Vinyles', ''),
(65, 'autre', 'Bijou', ''),
(66, 'autre', 'Bijou', ''),
(67, 'Bricolage Jardinage Hobbies', 'Articles sport', ''),
(68, 'Vêtements adultes et linge de maison', 'ceinture, foulards', ''),
(69, 'autre', 'Bijoux', ''),
(70, 'Vêtements adultes et linge de maison', 'Manteau', ''),
(71, 'Appareils électriques', 'Radiateur ', ''),
(72, 'Mobilier', 'Canapé ', ''),
(73, 'Mobilier', 'Table', ''),
(74, 'autre', 'laine', ''),
(75, 'autre', 'Bijou', ''),
(76, 'autre', 'Sport', NULL),
(77, 'autre', 'Bureautique ', NULL),
(78, 'Vaisselle Décoration', 'Vaisselle', NULL),
(79, 'Appareils électriques', 'Téléphones et accessoires ', NULL),
(80, 'parent', 'Materiel de bureau', 'materiel-bureau'),
(81, 'Mobilier', 'Enfant', NULL),
(82, 'Mobilier', 'Enfant', NULL),
(83, 'autre', 'Objets diverses', NULL),
(84, 'Enfants', 'Deguisement', NULL),
(85, 'Materiel de bureau', 'Bureau', NULL),
(86, 'Vêtements adultes et linge de maison', 'Bijoux', 'vetements-adulte');

-- --------------------------------------------------------

--
-- Structure de la table `client`
--

CREATE TABLE `client` (
  `id_client` int(11) NOT NULL,
  `mail` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `client`
--

INSERT INTO `client` (`id_client`, `mail`) VALUES
(1, 'zozo@asso.com');

-- --------------------------------------------------------

--
-- Structure de la table `commentaire`
--

CREATE TABLE `commentaire` (
  `id_comm` int(11) NOT NULL,
  `id_projet` int(11) NOT NULL,
  `id_respo` int(11) NOT NULL,
  `date` datetime NOT NULL,
  `commentaire` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `commentaire`
--

INSERT INTO `commentaire` (`id_comm`, `id_projet`, `id_respo`, `date`, `commentaire`) VALUES
(5, 13, 2, '2023-11-17 08:04:30', 'essai essai essai essai essai essai essai essai essaiessai essai essai essai essai essai essai essai essai essai essai essai essai essai essa'),
(6, 13, 1, '2023-11-17 08:55:30', 'essai essai essaiessai essai essaiessai essai essaiessai essai essaiessai essai essaiessai essai essaiessai essai essaiessai essai essaiessai essai essaiessai essai essaiessai essai essaiessai essai essaiessai'),
(8, 13, 3, '2023-11-17 09:35:00', 'nouveau comm'),
(10, 14, 3, '2023-11-17 18:08:00', 'Projet encours'),
(16, 12, 3, '2023-11-27 20:16:00', 'gdgd'),
(17, 12, 3, '2023-11-27 20:24:00', 'gdgd');

-- --------------------------------------------------------

--
-- Structure de la table `compte_transac`
--

CREATE TABLE `compte_transac` (
  `date_transac` date NOT NULL,
  `compte` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `compte_transac`
--

INSERT INTO `compte_transac` (`date_transac`, `compte`) VALUES
('2023-12-19', 1);

-- --------------------------------------------------------

--
-- Structure de la table `date_users`
--

CREATE TABLE `date_users` (
  `id_user` int(11) NOT NULL,
  `date_inscription` datetime NOT NULL,
  `date_derniere_visite` datetime NOT NULL,
  `date_dernier_creneau` int(11) DEFAULT NULL,
  `date_prochain_creneau` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `date_users`
--

INSERT INTO `date_users` (`id_user`, `date_inscription`, `date_derniere_visite`, `date_dernier_creneau`, `date_prochain_creneau`) VALUES
(1, '2022-05-12 12:02:36', '2023-01-03 11:02:29', 0, NULL),
(2, '2022-01-12 12:02:36', '2023-01-03 11:02:29', 0, NULL),
(3, '2022-01-13 12:02:36', '2024-01-30 12:03:00', 0, NULL),
(4, '2022-04-14 12:02:36', '2023-01-03 11:02:29', 0, NULL),
(5, '2022-03-24 12:02:36', '2023-01-03 11:02:29', 0, NULL),
(6, '2022-05-20 12:02:36', '2023-01-12 15:32:00', 0, NULL),
(7, '2022-05-17 12:02:36', '2023-01-03 11:02:29', 0, NULL),
(8, '2022-09-08 12:02:36', '2023-01-15 21:31:00', 0, NULL),
(9, '2022-11-17 12:02:36', '2023-01-03 11:02:29', 0, NULL),
(10, '2022-12-20 12:02:36', '2023-01-03 11:02:29', 0, NULL),
(12, '2023-01-03 15:05:00', '2023-01-15 21:29:00', 0, NULL),
(13, '2023-01-13 15:57:00', '2023-01-13 15:57:00', NULL, NULL),
(14, '2023-01-15 21:31:00', '2023-01-15 21:31:00', NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL,
  `cat_creneau` int(11) NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `start` datetime NOT NULL,
  `end` datetime DEFAULT NULL,
  `public` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `events`
--

INSERT INTO `events` (`id`, `cat_creneau`, `name`, `description`, `start`, `end`, `public`) VALUES
(1324, 0, 'Ouverture', '', '2023-09-04 14:00:00', '2023-09-04 18:00:00', 1),
(1325, 1, 'Ouverture', '', '2023-09-04 14:00:00', '2023-09-04 16:00:00', NULL),
(1326, 1, 'Ouverture', '', '2023-09-04 16:00:00', '2023-09-04 18:00:00', NULL),
(1327, 0, 'Ouverture', '', '2023-09-18 14:00:00', '2023-09-18 18:00:00', 1),
(1328, 1, 'Ouverture', '', '2023-09-18 14:00:00', '2023-09-18 16:00:00', NULL),
(1329, 1, 'Ouverture', '', '2023-09-18 16:00:00', '2023-09-18 18:00:00', NULL),
(1330, 0, 'Ouverture', '', '2023-10-02 14:00:00', '2023-10-02 18:00:00', 1),
(1331, 1, 'Ouverture', '', '2023-10-02 14:00:00', '2023-10-02 16:00:00', NULL),
(1332, 1, 'Ouverture', '', '2023-10-02 16:00:00', '2023-10-02 18:00:00', NULL),
(1333, 0, 'Ouverture', '', '2023-10-16 14:00:00', '2023-10-16 18:00:00', 1),
(1334, 1, 'Ouverture', '', '2023-10-16 14:00:00', '2023-10-16 16:00:00', NULL),
(1335, 1, 'Ouverture', '', '2023-10-16 16:00:00', '2023-10-16 18:00:00', NULL),
(1336, 0, 'Ouverture', '', '2023-10-30 14:00:00', '2023-10-30 18:00:00', 1),
(1337, 1, 'Ouverture', '', '2023-10-30 14:00:00', '2023-10-30 16:00:00', NULL),
(1338, 1, 'Ouverture', '', '2023-10-30 16:00:00', '2023-10-30 18:00:00', NULL),
(1339, 0, 'Ouverture', '', '2023-11-13 14:00:00', '2023-11-13 18:00:00', 1),
(1340, 1, 'Ouverture', '', '2023-11-13 14:00:00', '2023-11-13 16:00:00', NULL),
(1341, 1, 'Ouverture', '', '2023-11-13 16:00:00', '2023-11-13 18:00:00', NULL),
(1342, 0, 'Ouverture', '', '2023-11-27 14:00:00', '2023-11-27 18:00:00', 1),
(1343, 1, 'Ouverture', '', '2023-11-27 14:00:00', '2023-11-27 16:00:00', NULL),
(1344, 1, 'Ouverture', '', '2023-11-27 16:00:00', '2023-11-27 18:00:00', NULL),
(1345, 0, 'Ouverture', '', '2023-12-11 14:00:00', '2023-12-11 18:00:00', 1),
(1346, 1, 'Ouverture', '', '2023-12-11 14:00:00', '2023-12-11 16:00:00', NULL),
(1347, 1, 'Ouverture', '', '2023-12-11 16:00:00', '2023-12-11 18:00:00', NULL),
(1348, 0, 'Ouverture', '', '2023-10-09 14:00:00', '2023-10-09 18:00:00', 1),
(1349, 1, 'Ouverture', '', '2023-10-09 14:00:00', '2023-10-09 16:00:00', NULL),
(1350, 1, 'Ouverture', '', '2023-10-09 16:00:00', '2023-10-09 18:00:00', NULL),
(1351, 0, 'Ouverture', '', '2023-10-23 14:00:00', '2023-10-23 18:00:00', 1),
(1352, 1, 'Ouverture', '', '2023-10-23 14:00:00', '2023-10-23 16:00:00', NULL),
(1353, 1, 'Ouverture', '', '2023-10-23 16:00:00', '2023-10-23 18:00:00', NULL),
(1354, 0, 'Ouverture', '', '2023-11-06 14:00:00', '2023-11-06 18:00:00', 1),
(1355, 1, 'Ouverture', '', '2023-11-06 14:00:00', '2023-11-06 16:00:00', NULL),
(1356, 1, 'Ouverture', '', '2023-11-06 16:00:00', '2023-11-06 18:00:00', NULL),
(1357, 0, 'Ouverture', '', '2023-11-20 14:00:00', '2023-11-20 18:00:00', 1),
(1358, 1, 'Ouverture', '', '2023-11-20 14:00:00', '2023-11-20 16:00:00', NULL),
(1359, 1, 'Ouverture', '', '2023-11-20 16:00:00', '2023-11-20 18:00:00', NULL),
(1360, 0, 'Ouverture', '', '2023-12-04 14:00:00', '2023-12-04 18:00:00', NULL),
(1361, 1, 'Ouverture', '', '2023-12-04 14:00:00', '2023-12-04 16:00:00', NULL),
(1362, 1, 'Ouverture', '', '2023-12-04 16:00:00', '2023-12-04 18:00:00', NULL),
(1363, 0, 'Ouverture', '', '2023-12-18 14:00:00', '2023-12-18 18:00:00', NULL),
(1364, 1, 'Ouverture', '', '2023-12-18 14:00:00', '2023-12-18 16:00:00', NULL),
(1365, 1, 'Ouverture', '', '2023-12-18 16:00:00', '2023-12-18 18:00:00', NULL),
(1366, 0, 'Ouverture', '', '2023-12-25 14:00:00', '2023-12-25 18:00:00', NULL),
(1367, 1, 'Ouverture', '', '2023-12-25 14:00:00', '2023-12-25 16:00:00', NULL),
(1368, 1, 'Ouverture', '', '2023-12-25 16:00:00', '2023-12-25 18:00:00', NULL),
(1369, 0, 'Ouverture', '', '2024-01-01 14:00:00', '2024-01-01 18:00:00', NULL),
(1370, 1, 'Ouverture', '', '2024-01-01 14:00:00', '2024-01-01 16:00:00', NULL),
(1371, 1, 'Ouverture', '', '2024-01-01 16:00:00', '2024-01-01 18:00:00', NULL),
(1372, 0, 'Ouverture', '', '2023-10-03 14:00:00', '2023-10-03 18:00:00', NULL),
(1373, 1, 'Ouverture', '', '2023-10-03 14:00:00', '2023-10-03 16:00:00', NULL),
(1374, 1, 'Ouverture', '', '2023-10-03 16:00:00', '2023-10-03 18:00:00', NULL),
(1375, 0, 'Ouverture', '', '2023-10-10 14:00:00', '2023-10-10 18:00:00', NULL),
(1376, 1, 'Ouverture', '', '2023-10-10 14:00:00', '2023-10-10 16:00:00', NULL),
(1377, 1, 'Ouverture', '', '2023-10-10 16:00:00', '2023-10-10 18:00:00', NULL),
(1378, 0, 'Ouverture', '', '2023-10-17 14:00:00', '2023-10-17 18:00:00', NULL),
(1379, 1, 'Ouverture', '', '2023-10-17 14:00:00', '2023-10-17 16:00:00', NULL),
(1380, 1, 'Ouverture', '', '2023-10-17 16:00:00', '2023-10-17 18:00:00', NULL),
(1381, 0, 'Ouverture', '', '2023-10-24 14:00:00', '2023-10-24 18:00:00', NULL),
(1382, 1, 'Ouverture', '', '2023-10-24 14:00:00', '2023-10-24 16:00:00', NULL),
(1383, 1, 'Ouverture', '', '2023-10-24 16:00:00', '2023-10-24 18:00:00', NULL),
(1384, 0, 'Ouverture', '', '2023-10-31 14:00:00', '2023-10-31 18:00:00', NULL),
(1385, 1, 'Ouverture', '', '2023-10-31 14:00:00', '2023-10-31 16:00:00', NULL),
(1386, 1, 'Ouverture', '', '2023-10-31 16:00:00', '2023-10-31 18:00:00', NULL),
(1387, 0, 'Ouverture', '', '2023-11-07 14:00:00', '2023-11-07 18:00:00', NULL),
(1388, 1, 'Ouverture', '', '2023-11-07 14:00:00', '2023-11-07 16:00:00', NULL),
(1389, 1, 'Ouverture', '', '2023-11-07 16:00:00', '2023-11-07 18:00:00', NULL),
(1390, 0, 'Ouverture', '', '2023-11-14 14:00:00', '2023-11-14 18:00:00', NULL),
(1391, 1, 'Ouverture', '', '2023-11-14 14:00:00', '2023-11-14 16:00:00', NULL),
(1392, 1, 'Ouverture', '', '2023-11-14 16:00:00', '2023-11-14 18:00:00', NULL),
(1393, 0, 'Ouverture', '', '2023-11-21 14:00:00', '2023-11-21 18:00:00', 1),
(1394, 1, 'Ouverture', '', '2023-11-21 14:00:00', '2023-11-21 16:00:00', NULL),
(1395, 1, 'Ouverture', '', '2023-11-21 16:00:00', '2023-11-21 18:00:00', NULL),
(1396, 0, 'Ouverture', '', '2023-11-28 14:00:00', '2023-11-28 18:00:00', 1),
(1397, 1, 'Ouverture', '', '2023-11-28 14:00:00', '2023-11-28 16:00:00', NULL),
(1398, 1, 'Ouverture', '', '2023-11-28 16:00:00', '2023-11-28 18:00:00', NULL),
(1399, 0, 'Ouverture', '', '2023-12-05 14:00:00', '2023-12-05 18:00:00', 1),
(1400, 1, 'Ouverture', '', '2023-12-05 14:00:00', '2023-12-05 16:00:00', NULL),
(1401, 1, 'Ouverture', '', '2023-12-05 16:00:00', '2023-12-05 18:00:00', NULL),
(1402, 0, 'Ouverture', '', '2023-12-12 14:00:00', '2023-12-12 18:00:00', 1),
(1403, 1, 'Ouverture', '', '2023-12-12 14:00:00', '2023-12-12 16:00:00', NULL),
(1404, 1, 'Ouverture', '', '2023-12-12 16:00:00', '2023-12-12 18:00:00', NULL),
(1405, 0, 'Ouverture', '', '2023-12-19 14:00:00', '2023-12-19 18:00:00', 1),
(1406, 1, 'Ouverture', '', '2023-12-19 14:00:00', '2023-12-19 16:00:00', NULL),
(1407, 1, 'Ouverture', '', '2023-12-19 16:00:00', '2023-12-19 18:00:00', NULL),
(1408, 0, 'Ouverture', '', '2023-12-26 14:00:00', '2023-12-26 18:00:00', 1),
(1409, 1, 'Ouverture', '', '2023-12-26 14:00:00', '2023-12-26 16:00:00', NULL),
(1410, 1, 'Ouverture', '', '2023-12-26 16:00:00', '2023-12-26 18:00:00', NULL),
(1411, 0, 'Ouverture', '', '2024-01-02 14:00:00', '2024-01-02 18:00:00', 1),
(1412, 1, 'Ouverture', '', '2024-01-02 14:00:00', '2024-01-02 16:00:00', NULL),
(1413, 1, 'Ouverture', '', '2024-01-02 16:00:00', '2024-01-02 18:00:00', NULL),
(1414, 0, 'Ouverture', '', '2023-09-28 14:00:00', '2023-09-28 18:00:00', NULL),
(1415, 1, 'Ouverture', '', '2023-09-28 14:00:00', '2023-09-28 16:00:00', NULL),
(1416, 1, 'Ouverture', '', '2023-09-28 16:00:00', '2023-09-28 18:00:00', NULL),
(1417, 0, 'Ouverture', '', '2023-10-05 14:00:00', '2023-10-05 18:00:00', NULL),
(1418, 1, 'Ouverture', '', '2023-10-05 14:00:00', '2023-10-05 16:00:00', NULL),
(1419, 1, 'Ouverture', '', '2023-10-05 16:00:00', '2023-10-05 18:00:00', NULL),
(1420, 0, 'Ouverture', '', '2023-10-12 14:00:00', '2023-10-12 18:00:00', NULL),
(1421, 1, 'Ouverture', '', '2023-10-12 14:00:00', '2023-10-12 16:00:00', NULL),
(1422, 1, 'Ouverture', '', '2023-10-12 16:00:00', '2023-10-12 18:00:00', NULL),
(1423, 0, 'Ouverture', '', '2023-10-19 14:00:00', '2023-10-19 18:00:00', NULL),
(1424, 1, 'Ouverture', '', '2023-10-19 14:00:00', '2023-10-19 16:00:00', NULL),
(1425, 1, 'Ouverture', '', '2023-10-19 16:00:00', '2023-10-19 18:00:00', NULL),
(1426, 0, 'Ouverture', '', '2023-10-26 14:00:00', '2023-10-26 18:00:00', NULL),
(1427, 1, 'Ouverture', '', '2023-10-26 14:00:00', '2023-10-26 16:00:00', NULL),
(1428, 1, 'Ouverture', '', '2023-10-26 16:00:00', '2023-10-26 18:00:00', NULL),
(1429, 0, 'Ouverture', '', '2023-11-02 14:00:00', '2023-11-02 18:00:00', NULL),
(1430, 1, 'Ouverture', '', '2023-11-02 14:00:00', '2023-11-02 16:00:00', NULL),
(1431, 1, 'Ouverture', '', '2023-11-02 16:00:00', '2023-11-02 18:00:00', NULL),
(1432, 0, 'Ouverture', '', '2023-11-09 14:00:00', '2023-11-09 18:00:00', NULL),
(1433, 1, 'Ouverture', '', '2023-11-09 14:00:00', '2023-11-09 16:00:00', NULL),
(1434, 1, 'Ouverture', '', '2023-11-09 16:00:00', '2023-11-09 18:00:00', NULL),
(1435, 0, 'Ouverture', '', '2023-11-16 14:00:00', '2023-11-16 18:00:00', NULL),
(1436, 1, 'Ouverture', '', '2023-11-16 14:00:00', '2023-11-16 16:00:00', NULL),
(1437, 1, 'Ouverture', '', '2023-11-16 16:00:00', '2023-11-16 18:00:00', NULL),
(1438, 0, 'Ouverture', '', '2023-11-23 14:00:00', '2023-11-23 18:00:00', NULL),
(1439, 1, 'Ouverture', '', '2023-11-23 14:00:00', '2023-11-23 16:00:00', NULL),
(1440, 1, 'Ouverture', '', '2023-11-23 16:00:00', '2023-11-23 18:00:00', NULL),
(1441, 0, 'Ouverture', '', '2023-11-30 14:00:00', '2023-11-30 18:00:00', NULL),
(1442, 1, 'Ouverture', '', '2023-11-30 14:00:00', '2023-11-30 16:00:00', NULL),
(1443, 1, 'Ouverture', '', '2023-11-30 16:00:00', '2023-11-30 18:00:00', NULL),
(1444, 0, 'Ouverture', '', '2023-12-07 14:00:00', '2023-12-07 18:00:00', NULL),
(1445, 1, 'Ouverture', '', '2023-12-07 14:00:00', '2023-12-07 16:00:00', NULL),
(1446, 1, 'Ouverture', '', '2023-12-07 16:00:00', '2023-12-07 18:00:00', NULL),
(1447, 0, 'Ouverture', '', '2023-12-14 14:00:00', '2023-12-14 18:00:00', NULL),
(1448, 1, 'Ouverture', '', '2023-12-14 14:00:00', '2023-12-14 16:00:00', NULL),
(1449, 1, 'Ouverture', '', '2023-12-14 16:00:00', '2023-12-14 18:00:00', NULL),
(1450, 0, 'Ouverture', '', '2023-12-21 14:00:00', '2023-12-21 18:00:00', NULL),
(1451, 1, 'Ouverture', '', '2023-12-21 14:00:00', '2023-12-21 16:00:00', NULL),
(1452, 1, 'Ouverture', '', '2023-12-21 16:00:00', '2023-12-21 18:00:00', NULL),
(1453, 0, 'Ouverture', '', '2023-12-28 14:00:00', '2023-12-28 18:00:00', NULL),
(1454, 1, 'Ouverture', '', '2023-12-28 14:00:00', '2023-12-28 16:00:00', NULL),
(1455, 1, 'Ouverture', '', '2023-12-28 16:00:00', '2023-12-28 18:00:00', NULL),
(1456, 0, 'Ouverture', '', '2023-09-30 14:00:00', '2023-09-30 18:00:00', NULL),
(1457, 1, 'Ouverture', '', '2023-09-30 14:00:00', '2023-09-30 16:00:00', NULL),
(1458, 1, 'Ouverture', '', '2023-09-30 16:00:00', '2023-09-30 18:00:00', NULL),
(1459, 0, 'Ouverture', '', '2023-10-07 14:00:00', '2023-10-07 18:00:00', NULL),
(1460, 1, 'Ouverture', '', '2023-10-07 14:00:00', '2023-10-07 16:00:00', NULL),
(1461, 1, 'Ouverture', '', '2023-10-07 16:00:00', '2023-10-07 18:00:00', NULL),
(1462, 0, 'Ouverture', '', '2023-10-14 14:00:00', '2023-10-14 18:00:00', NULL),
(1463, 1, 'Ouverture', '', '2023-10-14 14:00:00', '2023-10-14 16:00:00', NULL),
(1464, 1, 'Ouverture', '', '2023-10-14 16:00:00', '2023-10-14 18:00:00', NULL),
(1465, 0, 'Ouverture', '', '2023-10-21 14:00:00', '2023-10-21 18:00:00', NULL),
(1466, 1, 'Ouverture', '', '2023-10-21 14:00:00', '2023-10-21 16:00:00', NULL),
(1467, 1, 'Ouverture', '', '2023-10-21 16:00:00', '2023-10-21 18:00:00', NULL),
(1468, 0, 'Ouverture', '', '2023-10-28 14:00:00', '2023-10-28 18:00:00', NULL),
(1469, 1, 'Ouverture', '', '2023-10-28 14:00:00', '2023-10-28 16:00:00', NULL),
(1470, 1, 'Ouverture', '', '2023-10-28 16:00:00', '2023-10-28 18:00:00', NULL),
(1471, 0, 'Ouverture', '', '2023-11-04 14:00:00', '2023-11-04 18:00:00', NULL),
(1472, 1, 'Ouverture', '', '2023-11-04 14:00:00', '2023-11-04 16:00:00', NULL),
(1473, 1, 'Ouverture', '', '2023-11-04 16:00:00', '2023-11-04 18:00:00', NULL),
(1474, 0, 'Ouverture', '', '2023-11-11 14:00:00', '2023-11-11 18:00:00', NULL),
(1475, 1, 'Ouverture', '', '2023-11-11 14:00:00', '2023-11-11 16:00:00', NULL),
(1476, 1, 'Ouverture', '', '2023-11-11 16:00:00', '2023-11-11 18:00:00', NULL),
(1477, 0, 'Ouverture', '', '2023-11-18 14:00:00', '2023-11-18 18:00:00', NULL),
(1478, 1, 'Ouverture', '', '2023-11-18 14:00:00', '2023-11-18 16:00:00', NULL),
(1479, 1, 'Ouverture', '', '2023-11-18 16:00:00', '2023-11-18 18:00:00', NULL),
(1480, 0, 'Ouverture', '', '2023-11-25 14:00:00', '2023-11-25 18:00:00', NULL),
(1481, 1, 'Ouverture', '', '2023-11-25 14:00:00', '2023-11-25 16:00:00', NULL),
(1482, 1, 'Ouverture', '', '2023-11-25 16:00:00', '2023-11-25 18:00:00', NULL),
(1483, 0, 'Ouverture', '', '2023-12-02 14:00:00', '2023-12-02 18:00:00', NULL),
(1484, 1, 'Ouverture', '', '2023-12-02 14:00:00', '2023-12-02 16:00:00', NULL),
(1485, 1, 'Ouverture', '', '2023-12-02 16:00:00', '2023-12-02 18:00:00', NULL),
(1486, 0, 'Ouverture', '', '2023-12-09 14:00:00', '2023-12-09 18:00:00', NULL),
(1487, 1, 'Ouverture', '', '2023-12-09 14:00:00', '2023-12-09 16:00:00', NULL),
(1488, 1, 'Ouverture', '', '2023-12-09 16:00:00', '2023-12-09 18:00:00', NULL),
(1489, 0, 'Ouverture', '', '2023-12-16 14:00:00', '2023-12-16 18:00:00', NULL),
(1490, 1, 'Ouverture', '', '2023-12-16 14:00:00', '2023-12-16 16:00:00', NULL),
(1491, 1, 'Ouverture', '', '2023-12-16 16:00:00', '2023-12-16 18:00:00', NULL),
(1492, 0, 'Ouverture', '', '2023-12-23 14:00:00', '2023-12-23 18:00:00', NULL),
(1493, 1, 'Ouverture', '', '2023-12-23 14:00:00', '2023-12-23 16:00:00', NULL),
(1494, 1, 'Ouverture', '', '2023-12-23 16:00:00', '2023-12-23 18:00:00', NULL),
(1495, 0, 'Ouverture', '', '2023-12-30 14:00:00', '2023-12-30 18:00:00', NULL),
(1496, 1, 'Ouverture', '', '2023-12-30 14:00:00', '2023-12-30 16:00:00', NULL),
(1497, 1, 'Ouverture', '', '2023-12-30 16:00:00', '2023-12-30 18:00:00', NULL),
(1498, 0, 'Ouverture', '', '2024-01-15 14:00:00', '2024-01-15 18:00:00', NULL),
(1499, 1, 'Ouverture', '', '2024-01-15 14:00:00', '2024-01-15 16:00:00', NULL),
(1500, 1, 'Ouverture', '', '2024-01-15 16:00:00', '2024-01-15 18:00:00', NULL),
(1501, 0, 'Ouverture', '', '2024-01-29 14:00:00', '2024-01-29 18:00:00', NULL),
(1502, 1, 'Ouverture', '', '2024-01-29 14:00:00', '2024-01-29 16:00:00', NULL),
(1503, 1, 'Ouverture', '', '2024-01-29 16:00:00', '2024-01-29 18:00:00', NULL),
(1504, 0, 'Ouverture', '', '2024-02-12 14:00:00', '2024-02-12 18:00:00', NULL),
(1505, 1, 'Ouverture', '', '2024-02-12 14:00:00', '2024-02-12 16:00:00', NULL),
(1506, 1, 'Ouverture', '', '2024-02-12 16:00:00', '2024-02-12 18:00:00', NULL),
(1507, 0, 'Ouverture', '', '2024-02-26 14:00:00', '2024-02-26 18:00:00', NULL),
(1508, 1, 'Ouverture', '', '2024-02-26 14:00:00', '2024-02-26 16:00:00', NULL),
(1509, 1, 'Ouverture', '', '2024-02-26 16:00:00', '2024-02-26 18:00:00', NULL),
(1510, 0, 'Ouverture', '', '2024-03-11 14:00:00', '2024-03-11 18:00:00', NULL),
(1511, 1, 'Ouverture', '', '2024-03-11 14:00:00', '2024-03-11 16:00:00', NULL),
(1512, 1, 'Ouverture', '', '2024-03-11 16:00:00', '2024-03-11 18:00:00', NULL),
(1513, 0, 'Ouverture', '', '2024-01-04 14:00:00', '2024-01-04 18:00:00', NULL),
(1514, 1, 'Ouverture', '', '2024-01-04 14:00:00', '2024-01-04 16:00:00', NULL),
(1515, 1, 'Ouverture', '', '2024-01-04 16:00:00', '2024-01-04 18:00:00', NULL),
(1516, 0, 'Ouverture', '', '2024-01-18 14:00:00', '2024-01-18 18:00:00', NULL),
(1517, 1, 'Ouverture', '', '2024-01-18 14:00:00', '2024-01-18 16:00:00', NULL),
(1518, 1, 'Ouverture', '', '2024-01-18 16:00:00', '2024-01-18 18:00:00', NULL),
(1519, 0, 'Ouverture', '', '2024-02-01 14:00:00', '2024-02-01 18:00:00', NULL),
(1520, 1, 'Ouverture', '', '2024-02-01 14:00:00', '2024-02-01 16:00:00', NULL),
(1521, 1, 'Ouverture', '', '2024-02-01 16:00:00', '2024-02-01 18:00:00', NULL),
(1522, 0, 'Ouverture', '', '2024-02-15 14:00:00', '2024-02-15 18:00:00', NULL),
(1523, 1, 'Ouverture', '', '2024-02-15 14:00:00', '2024-02-15 16:00:00', NULL),
(1524, 1, 'Ouverture', '', '2024-02-15 16:00:00', '2024-02-15 18:00:00', NULL),
(1525, 0, 'Ouverture', '', '2024-02-29 14:00:00', '2024-02-29 18:00:00', NULL),
(1526, 1, 'Ouverture', '', '2024-02-29 14:00:00', '2024-02-29 16:00:00', NULL),
(1527, 1, 'Ouverture', '', '2024-02-29 16:00:00', '2024-02-29 18:00:00', NULL),
(1528, 0, 'Ouverture', '', '2024-03-14 14:00:00', '2024-03-14 18:00:00', NULL),
(1529, 1, 'Ouverture', '', '2024-03-14 14:00:00', '2024-03-14 16:00:00', NULL),
(1530, 1, 'Ouverture', '', '2024-03-14 16:00:00', '2024-03-14 18:00:00', NULL),
(1531, 0, 'Ouverture', '', '2024-01-06 14:00:00', '2024-01-06 18:00:00', NULL),
(1532, 1, 'Ouverture', '', '2024-01-06 14:00:00', '2024-01-06 16:00:00', NULL),
(1533, 1, 'Ouverture', '', '2024-01-06 16:00:00', '2024-01-06 18:00:00', NULL),
(1534, 0, 'Ouverture', '', '2024-01-20 14:00:00', '2024-01-20 18:00:00', NULL),
(1535, 1, 'Ouverture', '', '2024-01-20 14:00:00', '2024-01-20 16:00:00', NULL),
(1536, 1, 'Ouverture', '', '2024-01-20 16:00:00', '2024-01-20 18:00:00', NULL),
(1537, 0, 'Ouverture', '', '2024-02-03 14:00:00', '2024-02-03 18:00:00', NULL),
(1538, 1, 'Ouverture', '', '2024-02-03 14:00:00', '2024-02-03 16:00:00', NULL),
(1539, 1, 'Ouverture', '', '2024-02-03 16:00:00', '2024-02-03 18:00:00', NULL),
(1540, 0, 'Ouverture', '', '2024-02-17 14:00:00', '2024-02-17 18:00:00', NULL),
(1541, 1, 'Ouverture', '', '2024-02-17 14:00:00', '2024-02-17 16:00:00', NULL),
(1542, 1, 'Ouverture', '', '2024-02-17 16:00:00', '2024-02-17 18:00:00', NULL),
(1543, 0, 'Ouverture', '', '2024-03-02 14:00:00', '2024-03-02 18:00:00', NULL),
(1544, 1, 'Ouverture', '', '2024-03-02 14:00:00', '2024-03-02 16:00:00', NULL),
(1545, 1, 'Ouverture', '', '2024-03-02 16:00:00', '2024-03-02 18:00:00', NULL),
(1546, 0, 'Ouverture', '', '2024-03-16 14:00:00', '2024-03-16 18:00:00', NULL),
(1547, 1, 'Ouverture', '', '2024-03-16 14:00:00', '2024-03-16 16:00:00', NULL),
(1548, 1, 'Ouverture', '', '2024-03-16 16:00:00', '2024-03-16 18:00:00', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `fonction`
--

CREATE TABLE `fonction` (
  `id` int(11) NOT NULL,
  `fonction` varchar(255) NOT NULL,
  `description` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `fonction`
--

INSERT INTO `fonction` (`id`, `fonction`, `description`) VALUES
(1, 'Vente', ''),
(2, 'Accueil dépôt', ''),
(3, 'Atelier', ''),
(4, 'Tri Vêtements', ''),
(5, 'Vérification jeux/jouets', '');

-- --------------------------------------------------------

--
-- Structure de la table `inscription_creneau`
--

CREATE TABLE `inscription_creneau` (
  `id_inscription` int(11) NOT NULL,
  `id_user` int(11) NOT NULL,
  `id_event` int(11) NOT NULL,
  `fonction` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `inscription_creneau`
--

INSERT INTO `inscription_creneau` (`id_inscription`, `id_user`, `id_event`, `fonction`) VALUES
(43, 8, 213, 'Vente'),
(44, 5, 213, 'Organisation/stockage'),
(52, 5, 509, 'N/A'),
(53, 2, 467, 'Accueil dépôt'),
(63, 4, 468, 'N/A'),
(64, 4, 467, 'N/A'),
(66, 2, 509, 'N/A'),
(80, 9, 510, 'N/A'),
(81, 10, 438, 'N/A'),
(82, 10, 522, 'N/A'),
(83, 10, 466, 'N/A'),
(84, 10, 508, 'N/A'),
(85, 10, 536, 'N/A'),
(86, 10, 480, 'N/A'),
(111, 1, 466, 'Vente'),
(112, 1, 536, 'Vente'),
(113, 1, 480, 'Vente'),
(114, 1, 494, 'Accueil dépôt'),
(115, 7, 469, 'N/A'),
(116, 7, 511, 'N/A'),
(118, 3, 481, 'N/A'),
(119, 6, 439, 'N/A'),
(120, 6, 515, 'N/A');

-- --------------------------------------------------------

--
-- Structure de la table `modifticketdecaisse`
--

CREATE TABLE `modifticketdecaisse` (
  `id_modif` int(11) NOT NULL,
  `id_ticket` int(11) NOT NULL,
  `nom_vendeur` varchar(255) NOT NULL,
  `id_vendeur` int(11) NOT NULL,
  `date_achat_dt` datetime DEFAULT NULL,
  `nbr_objet` int(11) NOT NULL,
  `moyen_paiement` text,
  `num_cheque` text,
  `banque` varchar(255) DEFAULT NULL,
  `num_transac` varchar(255) DEFAULT NULL,
  `prix_total` int(11) NOT NULL,
  `lien` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `modifticketdecaisse`
--

INSERT INTO `modifticketdecaisse` (`id_modif`, `id_ticket`, `nom_vendeur`, `id_vendeur`, `date_achat_dt`, `nbr_objet`, `moyen_paiement`, `num_cheque`, `banque`, `num_transac`, `prix_total`, `lien`) VALUES
(15, 288, 'Voillot', 3, '2023-07-13 22:43:00', 1, 'espèces', NULL, NULL, NULL, 700, 'tickets/Ticket288.txt'),
(16, 288, 'Voillot', 3, '2023-07-13 22:43:00', 1, 'carte', NULL, NULL, '7', 0, 'tickets/Ticket288.txt'),
(18, 289, 'Voillot', 3, '2023-07-13 22:44:00', 1, 'espèces', NULL, NULL, NULL, 700, 'tickets/Ticket289.txt'),
(19, 289, 'Voillot', 3, '2023-07-13 22:44:00', 1, 'espèces', NULL, NULL, NULL, 200, 'tickets/Ticket289.txt'),
(20, 289, 'Voillot', 3, '2023-07-13 22:44:00', 1, 'espèces', NULL, NULL, NULL, 1000, 'tickets/Ticket289.txt'),
(21, 286, 'Voillot', 3, '2023-07-13 22:20:00', 1, 'carte', NULL, NULL, '5', 200, 'tickets/Ticket286.txt'),
(22, 286, 'Voillot', 3, '2023-07-13 22:20:00', 3, 'espèces', NULL, NULL, NULL, 900, 'tickets/Ticket286.txt'),
(23, 289, 'Voillot', 3, '2023-07-13 22:44:00', 1, 'espèces', NULL, NULL, NULL, 500, 'tickets/Ticket289.txt'),
(25, 284, 'Voillot', 3, '2023-07-13 21:57:00', 2, 'espèces', NULL, NULL, NULL, 1300, 'tickets/Ticket284.txt'),
(26, 284, 'Voillot', 3, '2023-07-13 21:57:00', 3, 'espèces', NULL, NULL, NULL, 1700, 'tickets/Ticket284.txt'),
(27, 284, 'Voillot', 3, '2023-07-13 21:57:00', 2, 'espèces', NULL, NULL, NULL, 1300, 'tickets/Ticket284.txt'),
(28, 284, 'Voillot', 3, '2023-07-13 21:57:00', 1, 'espèces', NULL, NULL, NULL, 1000, 'tickets/Ticket284.txt'),
(29, 284, 'Voillot', 3, '2023-07-13 21:57:00', 3, 'espèces', NULL, NULL, NULL, 1400, 'tickets/Ticket284.txt'),
(30, 284, 'Voillot', 3, '2023-07-13 21:57:00', 4, 'espèces', NULL, NULL, NULL, 1500, 'tickets/Ticket284.txt'),
(31, 284, 'Voillot', 3, '2023-07-13 21:57:00', 3, 'espèces', NULL, NULL, NULL, 1400, 'tickets/Ticket284.txt'),
(32, 284, 'Voillot', 3, '2023-07-13 21:57:00', 2, 'espèces', NULL, NULL, NULL, 1300, 'tickets/Ticket284.txt'),
(33, 284, 'Voillot', 3, '2023-07-13 21:57:00', 1, 'carte', NULL, NULL, '8', 1000, 'tickets/Ticket284.txt'),
(34, 284, 'Voillot', 3, '2023-07-13 21:57:00', 2, 'espèces', NULL, NULL, NULL, 800, 'tickets/Ticket284.txt');

-- --------------------------------------------------------

--
-- Structure de la table `objets_collectes`
--

CREATE TABLE `objets_collectes` (
  `id` int(11) NOT NULL,
  `nom` varchar(255) NOT NULL,
  `categorie` varchar(255) NOT NULL,
  `souscat` varchar(255) NOT NULL,
  `poids` int(11) NOT NULL,
  `date` text NOT NULL,
  `timestamp` int(11) NOT NULL,
  `vendu` tinyint(1) NOT NULL,
  `flux` varchar(255) NOT NULL,
  `saisipar` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `objets_collectes`
--

INSERT INTO `objets_collectes` (`id`, `nom`, `categorie`, `souscat`, `poids`, `date`, `timestamp`, `vendu`, `flux`, `saisipar`) VALUES
(61, 'dsvqdsv', 'Vêtements adultes et linge de maison', '', 12345, '12/05/2022', 1652313600, 0, '', ''),
(63, 'jouet enfant', 'Mobilier', 'Bibliothèque', 100, '16/11/2022', 1668556800, 0, 'Porte-a-porte', ''),
(64, 'Pantalon homme', 'Vêtements adultes et linge de maison', '', 100, '16/11/2022', 1668556800, 0, '', ''),
(65, 'Bibelots', 'Vaisselle Décoration', '', 200, '16/11/2022', 1668556800, 0, '', ''),
(67, 'essai', 'Mobilier', '', 2000, '16/11/2022', 1668556800, 0, '', ''),
(68, 'essai', 'Mobilier', '', 2000, '16/11/2022', 1668556800, 0, '', ''),
(69, 'essai12263', 'Mobilier', '', 2000, '16/11/2022', 1668556800, 0, '', ''),
(70, 'essai dépôt', 'Vaisselle Décoration', '', 432, '17/11/2022', 1668643200, 0, '', ''),
(72, 'de mémé', 'Mobilier', 'Armoire', 3000, '18/11/2022', 1668729600, 0, 'Apport', ''),
(73, 'chaise bébé', 'Enfants', 'Matériel puériculture', 150, '19/11/2022', 1668816000, 0, 'Collecte', ''),
(74, 'Truc inconnu', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 300, '19/11/2022', 1668816000, 0, 'Apport', ''),
(75, 'Ikea', 'Mobilier', 'Bibliothèque', 20000, '19/11/2022', 1668816000, 0, 'Apport', 'Voillot'),
(284, '', 'Mobilier', 'Armoire', 40000, '24/11/2022', 1669297924, 0, 'Apport', 'Voillot'),
(285, '', 'Mobilier', 'Lit', 15000, '28/11/2022', 1669668016, 0, 'Apport', 'Voillot'),
(286, 'IKEA', 'Mobilier', 'Armoire', 6000, '28/11/2022', 1669671310, 0, 'Apport', 'Voillot'),
(287, 'Style ancien', 'Mobilier', 'Table de chevet', 2000, '28/11/2022', 1669673004, 0, 'Apport', 'Voillot'),
(288, '', 'Mobilier', 'Commode', 30000, '28/11/2022', 1669673106, 0, 'Apport', 'Voillot'),
(289, 'lnlkn', 'Mobilier', 'Commode', 3000, '28/11/2022', 1669673290, 0, 'Apport', 'Voillot'),
(290, 'zen', 'Mobilier', 'Table de chevet', 3000, '28/11/2022', 1669674054, 0, 'Apport', 'Voillot'),
(291, 'Essai', 'Appareils électriques', 'Hifi', 2001, '28/11/2022', 1669674074, 0, 'Apport', 'Voillot'),
(292, 'de marque SEB', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 501, '28/11/2022', 1669674309, 0, 'Apport', 'Voillot Seb'),
(293, '', 'Mobilier', 'Armoire', 2000, '05/12/2022', 1670231142, 0, 'Apport', 'Voillot Seb'),
(294, '', 'Mobilier', 'Commode', 3000, '05/12/2022', 1670273348, 0, 'Apport', 'Voillot Seb'),
(295, 'srgrega', 'Mobilier', 'Commode', 2000, '05/12/2022', 1670274421, 0, 'Apport', 'Grassart'),
(296, 'gzefiqub', 'Livres adultes', 'Livres', 200, '05/12/2022', 1670274900, 0, 'Apport', 'Grassart Catherine'),
(297, '', 'Mobilier', 'Armoire', 3444, '05/12/2022', 1670274934, 0, 'Apport', 'Grassart Catherine'),
(298, 'essai', 'Mobilier', 'Commode', 20000, '10/12/2022', 1670691794, 0, 'Collecte', 'Voillot Enoha'),
(304, 'essai', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 2003, '10/12/2022', 1670692395, 0, 'Collecte', 'Voillot Seb'),
(305, 'essai', 'Mobilier', 'Bibliothèque', 1000, '12/12/2022', 1670886279, 0, 'Apport', 'Voillot Seb'),
(306, '', 'Vêtements adultes et linge de maison', 'Vêtements', 2000, '12/12/2022', 1670886291, 0, 'Apport', 'Voillot Seb'),
(307, '', 'Mobilier', 'Bibliothèque', 2000, '09/01/2023', 1673273056, 0, 'Apport', 'Voillot Seb'),
(308, '', 'Mobilier', 'Commode', 3000, '09/01/2023', 1673273448, 0, 'Apport', 'Voillot Seb'),
(309, '', 'Vêtements adultes et linge de maison', 'Linge de maison', 1560, '09/01/2023', 1673273501, 0, 'Apport', 'Voillot Seb'),
(314, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 300, '11/03/2023', 1678528912, 0, 'Apport', 'Voillot Seb'),
(315, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 350, '11/03/2023', 1678528929, 0, 'Apport', 'Voillot Seb'),
(316, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 300, '11/03/2023', 1678529023, 0, 'Apport', 'Voillot Seb'),
(317, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 100, '11/03/2023', 1678529254, 0, 'Apport', 'Voillot Seb'),
(318, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 300, '11/03/2023', 1678529316, 0, 'Apport', 'Voillot Seb'),
(319, '', 'Appareils électriques', 'Hifi', 400, '11/03/2023', 1678529343, 0, 'Apport', 'Voillot Seb'),
(320, '', 'Appareils électriques', 'Hifi', 500, '11/03/2023', 1678529427, 0, 'Apport', 'Voillot Seb'),
(321, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 400, '11/03/2023', 1678529622, 0, 'Apport', 'Voillot Seb'),
(322, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 400, '11/03/2023', 1678529635, 0, 'Apport', 'Voillot Seb'),
(323, '', 'Appareils électriques', 'Hifi', 500, '11/03/2023', 1678529648, 0, 'Apport', 'Voillot Seb'),
(324, '', 'Appareils électriques', 'Hifi', 400, '11/03/2023', 1678529749, 0, 'Apport', 'Voillot Seb'),
(325, '', 'Appareils électriques', 'Hifi', 300, '11/03/2023', 1678529873, 0, 'Apport', 'Voillot Seb'),
(326, '', 'Appareils électriques', 'Hifi', 400, '11/03/2023', 1678530401, 0, 'Apport', 'Voillot Seb'),
(327, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 700, '11/03/2023', 1678530452, 0, 'Apport', 'Voillot Seb'),
(328, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 400, '11/03/2023', 1678530528, 0, 'Apport', 'Voillot Seb'),
(329, '', 'Mobilier', 'Armoire', 300, '11/03/2023', 1678530578, 0, 'Apport', 'Voillot Seb'),
(330, '', 'Mobilier', 'Commode', 3000, '11/03/2023', 1678530634, 0, 'Apport', 'Voillot Seb'),
(331, '', 'Appareils électriques', 'Hifi', 4000, '11/03/2023', 1678530693, 0, 'Apport', 'Voillot Seb'),
(332, '', 'Mobilier', 'Armoire', 3000, '11/03/2023', 1678530717, 0, 'Apport', 'Voillot Seb'),
(333, '', 'Vêtements adultes et linge de maison', 'essai', 3, '11/03/2023', 1678531386, 0, 'Apport', 'Voillot Seb'),
(334, '', 'Vêtements adultes et linge de maison', 'Linge de maison', 34, '11/03/2023', 1678531748, 0, 'Apport', 'Voillot Seb'),
(335, '', 'Vêtements adultes et linge de maison', 'Linge de maison', 34, '11/03/2023', 1678531813, 0, 'Apport', 'Voillot Seb'),
(336, '', 'Appareils électriques', 'Hifi', 400, '11/03/2023', 1678531828, 0, 'Apport', 'Voillot Seb'),
(337, '', 'Mobilier', 'Armoire', 3, '11/03/2023', 1678531899, 0, 'Apport', 'Voillot Seb'),
(338, '', 'Mobilier', 'Armoire', 3, '11/03/2023', 1678531954, 0, 'Apport', 'Voillot Seb'),
(339, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 3, '11/03/2023', 1678531989, 0, 'Apport', 'Voillot Seb'),
(340, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 3, '11/03/2023', 1678532000, 0, 'Apport', 'Voillot Seb'),
(341, '', 'Mobilier', 'Commode', 3, '11/03/2023', 1678532059, 0, 'Apport', 'Voillot Seb'),
(342, '', 'Mobilier', 'Armoire', 3, '11/03/2023', 1678532093, 0, 'Apport', 'Voillot Seb'),
(343, '', 'Mobilier', 'Armoire', 3, '11/03/2023', 1678532141, 0, 'Apport', 'Voillot Seb'),
(344, '', 'Mobilier', 'Armoire', 3, '11/03/2023', 1678532271, 0, 'Apport', 'Voillot Seb'),
(345, '', 'Appareils électriques', 'Hifi', 3, '11/03/2023', 1678560838, 0, 'Apport', 'Voillot Seb'),
(346, '', 'Appareils électriques', 'Hifi', 4, '11/03/2023', 1678560865, 0, 'Apport', 'Voillot Seb'),
(347, '', 'Appareils électriques', 'Hifi', 30, '11/03/2023', 1678560930, 0, 'Apport', 'Voillot Seb'),
(348, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 200, '11/03/2023', 1678561124, 0, 'Apport', 'Voillot Seb'),
(349, '', 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 200, '12/03/2023', 1678617068, 0, 'Apport', 'essai1 essai1'),
(350, '', 'Mobilier', 'Bibliothèque', 2000, '31/03/2023', 1680274273, 0, 'Collecte', 'Voillot Seb');

-- --------------------------------------------------------

--
-- Structure de la table `objets_vendus`
--

CREATE TABLE `objets_vendus` (
  `id_achat` int(11) NOT NULL,
  `id_ticket` int(11) NOT NULL,
  `nom_vendeur` varchar(255) NOT NULL,
  `id_vendeur` int(11) NOT NULL,
  `nom` varchar(255) NOT NULL,
  `categorie` varchar(255) NOT NULL,
  `souscat` varchar(255) NOT NULL,
  `date_achat` text NOT NULL,
  `timestamp` int(11) NOT NULL,
  `prix` int(11) NOT NULL,
  `nbr` int(11) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `objets_vendus`
--

INSERT INTO `objets_vendus` (`id_achat`, `id_ticket`, `nom_vendeur`, `id_vendeur`, `nom`, `categorie`, `souscat`, `date_achat`, `timestamp`, `prix`, `nbr`) VALUES
(456, 298, 'Voillot', 3, 'Coussin à langer', 'Enfants', 'Matériel puériculture', '2023/12/19 21:10', 1703016604, 200, 1),
(457, 298, 'Voillot', 3, 'Peluche (grand modèle)', 'Enfants', 'Peluches', '2023/12/19 21:10', 1703016604, 200, 1),
(458, 298, 'Voillot', 3, 'Tapis (grand modèle)', 'Vaisselle Décoration', 'Décoration', '2023/12/19 21:10', 1703016604, 800, 1),
(459, 299, 'Voillot', 3, 'Coussin à langer', 'Enfants', 'Matériel puériculture', '2023/12/23 12:22', 1703330555, 200, 1),
(460, 299, 'Voillot', 3, 'Légos / Playmobiles (les 10)', 'Enfants', 'Jeux-Jouets', '2023/12/23 12:22', 1703330555, 200, 1),
(461, 299, 'Voillot', 3, 'Peluche (grand modèle)', 'Enfants', 'Peluches', '2023/12/23 12:22', 1703330555, 200, 1),
(462, 299, 'Voillot', 3, 'Jouet éveil électronique', 'Enfants', 'Jeux-Jouets', '2023/12/23 12:22', 1703330555, 5000, 1),
(463, 299, 'Voillot', 3, 'reduction gros panier', 'reduction gros panier', 'reduction gros panier', '2023/12/23 12:22', 1703330555, -6, 1),
(464, 300, 'Voillot', 3, 'Lit à barreaux', 'Enfants', 'Matériel puériculture', '2023/12/23 12:31', 1703331078, 6800, 1),
(465, 300, 'Voillot', 3, 'reduction gros panier', 'reduction gros panier', 'reduction gros panier', '2023/12/23 12:31', 1703331078, -680, 1),
(466, 301, 'Voillot', 3, 'Lit à barreaux', 'Enfants', 'Matériel puériculture', '2023/12/23 12:31', 1703331106, 12000, 1),
(467, 301, 'Voillot', 3, 'Jeu de construction', 'Enfants', 'Jeux-Jouets', '2023/12/23 12:31', 1703331106, 200, 1),
(468, 301, 'Voillot', 3, 'reduction gros panier', 'reduction gros panier', 'reduction gros panier', '2023/12/23 12:31', 1703331106, -1220, 1),
(469, 302, 'Voillot', 3, 'Lit à barreaux', 'Enfants', 'Matériel puériculture', '2023/12/23 12:52', 1703332324, 5500, 1),
(470, 302, 'Voillot', 3, 'reduction gros panier bénévole', 'reduction gros panier bénévole', 'reduction gros panier bénévole', '2023/12/23 12:52', 1703332324, -1100, 1),
(471, 303, 'Voillot', 3, 'Coussin à langer', 'Enfants', 'Matériel puériculture', '2023/12/23 12:52', 1703332352, 7800, 1),
(472, 303, 'Voillot', 3, 'reduction gros panier client', 'reduction gros panier client', 'reduction gros panier client', '2023/12/23 12:52', 1703332352, -780, 1);

-- --------------------------------------------------------

--
-- Structure de la table `objets_vendus_modif`
--

CREATE TABLE `objets_vendus_modif` (
  `id_objet_modif` int(11) NOT NULL,
  `id_modif` int(11) NOT NULL,
  `id_temp_vente` int(11) NOT NULL,
  `id_ticket` int(11) NOT NULL,
  `nom_vendeur` varchar(255) NOT NULL,
  `id_vendeur` int(11) NOT NULL,
  `nom` varchar(255) DEFAULT NULL,
  `categorie` varchar(255) DEFAULT NULL,
  `souscat` varchar(255) DEFAULT NULL,
  `date_achat` text NOT NULL,
  `timestamp` int(11) NOT NULL,
  `prix` int(11) NOT NULL,
  `nbr` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Structure de la table `paiement_mixte`
--

CREATE TABLE `paiement_mixte` (
  `id_paiement_mixte` int(11) NOT NULL,
  `id_ticket` int(11) NOT NULL,
  `espece` int(11) NOT NULL,
  `carte` int(11) NOT NULL,
  `cheque` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `paiement_mixte`
--

INSERT INTO `paiement_mixte` (`id_paiement_mixte`, `id_ticket`, `espece`, `carte`, `cheque`) VALUES
(1, 199, 1200, 400, 0),
(2, 203, 100, 2000, 0),
(3, 208, 1000, 300, 300),
(4, 232, 300, 300, 0),
(5, 233, 0, 1000, 50),
(6, 234, 1000, 50, 0),
(7, 235, 400, 0, 400),
(8, 236, 1000, 250, 0),
(9, 257, 400, 400, 0),
(10, 258, 300, 300, 0),
(11, 296, 600, 4000, 0);

-- --------------------------------------------------------

--
-- Structure de la table `paiement_mixte_modif`
--

CREATE TABLE `paiement_mixte_modif` (
  `id_paiement_mixte_modif` int(11) NOT NULL,
  `id_paiement_mixte` int(11) NOT NULL,
  `id_ticket` int(11) NOT NULL,
  `espece` int(11) NOT NULL,
  `carte` int(11) NOT NULL,
  `cheque` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Structure de la table `projet`
--

CREATE TABLE `projet` (
  `id` int(11) NOT NULL,
  `projet` varchar(255) NOT NULL,
  `id_respo` int(11) NOT NULL,
  `archive` tinyint(4) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `projet`
--

INSERT INTO `projet` (`id`, `projet`, `id_respo`, `archive`) VALUES
(1, 'Partenariat Veolia', 1, 1),
(2, 'Dossier subvention', 2, 1),
(5, 'New project', 3, 1),
(10, 'essai', 10, 1),
(12, 'new project', 3, 0),
(13, 'essai depuis la page projets archivés', 3, 0),
(14, 'nouveau projet', 5, 0),
(15, 'rescrit fiscal', 3, 1);

-- --------------------------------------------------------

--
-- Structure de la table `reparation`
--

CREATE TABLE `reparation` (
  `id_rep` int(11) NOT NULL,
  `id_objet` int(11) NOT NULL,
  `categorie` varchar(255) NOT NULL,
  `souscat` varchar(255) NOT NULL,
  `reparation` text NOT NULL,
  `saisipar` varchar(255) NOT NULL,
  `reparepar` varchar(255) NOT NULL,
  `date` varchar(255) NOT NULL,
  `timestamp` int(11) NOT NULL,
  `daterep` varchar(255) NOT NULL,
  `timestamprep` int(11) NOT NULL,
  `end` tinyint(4) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `reparation`
--

INSERT INTO `reparation` (`id_rep`, `id_objet`, `categorie`, `souscat`, `reparation`, `saisipar`, `reparepar`, `date`, `timestamp`, `daterep`, `timestamprep`, `end`) VALUES
(1, 286, '', '', 'Le coin supérieur droit est cassé /\r\nPlateau enlevé, nouveau coin façonné, en attente de collage.', 'Voillot', 'Bernard', '', 0, '29-11 16:35:05', 1669736105, 1),
(3, 287, 'Mobilier', 'Table de chevet', 'Un pied à visser ainsi qu\'un plateau à refaire', 'Voillot', '', '28-11 23:04:15', 1669673055, '11-03 19:57:54', 1678561074, 1),
(6, 288, 'Mobilier', 'Commode', 'Il faut la styliser', 'Voillot', '', '28-11 23:07:28', 1669673248, '11-03 19:57:57', 1678561077, 1),
(10, 289, 'Mobilier', 'Commode', 'hjkb', 'Voillot', '', '28-11 23:14:08', 1669673648, '11-03 19:57:59', 1678561079, 1),
(13, 291, 'Appareils électriques', 'Hifi', 'sdfvd/iudbqviuqeb', 'Voillot', 'Rolland', '28-11 23:22:59', 1669674179, '29-11 16:31:52', 1669735912, 1),
(14, 292, 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 'Il faut vérifier qu\'il fonctionne correctement', 'Voillot', '', '28-11 23:25:32', 1669674332, '11-03 19:57:52', 1678561072, 1),
(15, 293, 'Mobilier', 'Armoire', 'A verifier, C\'est fait', 'Voillot', 'Voillot', '05-12 10:18:56', 1670231936, '11-03 19:58:01', 1678561081, 1),
(16, 347, 'Appareils électriques', 'Hifi', 'Objet vérifier et fonctionne. objet nettoyé', 'Voillot', 'Voillot', '11-03 19:55:45', 1678560945, '11-03 19:57:16', 1678561036, 1),
(17, 348, 'Appareils électriques', 'Petit électroménager (Grille-pain, bouilloire...)', 'Le bouton est décollé, il faut le recoller.\r\nEn cours de séchage, l\'objet est reposé sur l\'étagère dans l\'atelier.\r\nLe collage est terminé, l\'objet passe à l\'étiquetage.', 'Voillot', 'Voillot', '11-03 19:59:35', 1678561175, '11-03 20:01:52', 1678561312, 1);

-- --------------------------------------------------------

--
-- Structure de la table `taches`
--

CREATE TABLE `taches` (
  `id_tache` int(11) NOT NULL,
  `id_projet` int(11) NOT NULL,
  `tache` varchar(255) NOT NULL,
  `complete` tinyint(2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `taches`
--

INSERT INTO `taches` (`id_tache`, `id_projet`, `tache`, `complete`) VALUES
(2, 1, 'essai 2', 1),
(6, 2, 'essai 6', 1),
(7, 2, 'essai 6', 1),
(10, 5, 'essai 7', 1),
(12, 1, 'essai 3', 1),
(14, 10, 'essai', 1),
(15, 10, 'autre', 1),
(16, 12, 'nouvelle tache', 0),
(17, 12, 'nouvelle tache 2', 0),
(18, 12, 'nouvelle tache 3', 0),
(20, 15, 'contacter l\'administration', 1),
(21, 15, 'répondre a mme untel', 1),
(22, 13, 'Tache 1', 0),
(23, 13, 'Tache 2', 1),
(24, 13, 'Tache 3', 1),
(25, 13, 'Tache 4', 1),
(26, 13, 'Tache 5', 0),
(29, 12, 'tache avec du texte un peu long pour voir comment ça s\'affiche', 1);

-- --------------------------------------------------------

--
-- Structure de la table `ticketdecaisse`
--

CREATE TABLE `ticketdecaisse` (
  `id_ticket` int(11) NOT NULL,
  `nom_vendeur` varchar(255) NOT NULL,
  `id_vendeur` int(11) NOT NULL,
  `date_achat_dt` datetime DEFAULT NULL,
  `nbr_objet` int(11) NOT NULL,
  `moyen_paiement` text,
  `num_cheque` text,
  `banque` varchar(255) DEFAULT NULL,
  `num_transac` varchar(255) DEFAULT NULL,
  `prix_total` int(11) NOT NULL,
  `lien` text NOT NULL,
  `reducbene` tinyint(4) DEFAULT NULL,
  `reducclient` tinyint(4) DEFAULT NULL,
  `reducgrospanier` tinyint(4) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `ticketdecaisse`
--

INSERT INTO `ticketdecaisse` (`id_ticket`, `nom_vendeur`, `id_vendeur`, `date_achat_dt`, `nbr_objet`, `moyen_paiement`, `num_cheque`, `banque`, `num_transac`, `prix_total`, `lien`, `reducbene`, `reducclient`, `reducgrospanier`) VALUES
(298, 'Voillot', 3, '2023-12-19 21:10:00', 3, 'carte', NULL, NULL, '1', 1200, 'tickets/Ticket298.txt', 0, 0, 0),
(299, 'Voillot', 3, '2023-12-23 12:22:00', 4, 'espèces', NULL, NULL, NULL, 5594, 'tickets/Ticket299.txt', 0, 0, 1),
(300, 'Voillot', 3, '2023-12-23 12:31:00', 1, 'espèces', NULL, NULL, NULL, 6120, 'tickets/Ticket300.txt', 0, 0, 1),
(301, 'Voillot', 3, '2023-12-23 12:31:00', 2, 'espèces', NULL, NULL, NULL, 10980, 'tickets/Ticket301.txt', 0, 0, 1),
(302, 'Voillot', 3, '2023-12-23 12:52:00', 1, 'espèces', NULL, NULL, NULL, 4400, 'tickets/Ticket302.txt', 0, 0, 0),
(303, 'Voillot', 3, '2023-12-23 12:52:00', 1, 'espèces', NULL, NULL, NULL, 7020, 'tickets/Ticket303.txt', 0, 0, 0);

-- --------------------------------------------------------

--
-- Structure de la table `ticketdecaissetemp`
--

CREATE TABLE `ticketdecaissetemp` (
  `id_temp_vente` int(11) NOT NULL,
  `id` int(11) NOT NULL,
  `nom_vendeur` varchar(255) NOT NULL,
  `id_vendeur` int(11) NOT NULL,
  `nom` varchar(255) NOT NULL,
  `categorie` varchar(255) NOT NULL,
  `souscat` varchar(255) NOT NULL,
  `prix` int(11) NOT NULL,
  `nbr` int(11) DEFAULT '1',
  `prixt` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `ticketdecaissetemp`
--

INSERT INTO `ticketdecaissetemp` (`id_temp_vente`, `id`, `nom_vendeur`, `id_vendeur`, `nom`, `categorie`, `souscat`, `prix`, `nbr`, `prixt`) VALUES
(6, 22, 'Voillot', 3, 'Coussin à langer', 'Enfants', 'Matériel puériculture', 5700, 1, 5700),
(6, 23, 'Voillot', 3, 'Petits jouets (figurines, petites voitures, petits poneys)', 'Enfants', 'Jeux-Jouets', 50, 1, 50),
(6, 26, 'Voillot', 3, 'reduction gros panier bénévole', 'reduction gros panier bénévole', 'reduction gros panier bénévole', -1150, 1, -1150);

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `prenom` varchar(255) NOT NULL,
  `nom` varchar(255) NOT NULL,
  `pseudo` varchar(255) NOT NULL,
  `password` text NOT NULL,
  `admin` tinyint(1) NOT NULL,
  `mail` varchar(255) DEFAULT NULL,
  `tel` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `prenom`, `nom`, `pseudo`, `password`, `admin`, `mail`, `tel`) VALUES
(1, 'emilie', 'voillot', 'emimi', '$2y$10$qhTeRXk.bCAFRMsMUyttmePjWK45UTdqkCb8CR3JKsH0lbTI//9K6', 1, NULL, NULL),
(2, 'Sebastien', 'Voillot', 'Zoy077', '$2y$10$OjG8DsMUxPS.WVd./tjRz.N9QK72.DEofGrspzeN1doCG6FulL5CW', 1, NULL, NULL),
(3, 'Seb', 'Voillot', 'sebobo', '$2y$10$oLH6NFI5IbsYr5orLFqvKezRu.WvFOBik.RyTo8HmG.jNMlCFbHRG', 2, 'sebastienvoillot@hotmail.com', '0664321120'),
(4, 'robin', 'voillot', 'Rvoillot', '$2y$10$/9bdV0P25mQTv1o66Iw2e.ro.p1KcboGP5ET.JC99/N/h/.mkXq4m', 2, NULL, NULL),
(5, 'Enoha', 'Voillot', 'enoha77', '$2y$10$tZrKWzr.q8LSZt0.rcxcROLohFlWb9bqwqOnZSsZAXtkajoKUM5km', 2, NULL, NULL),
(6, 'Emilie', 'Voillot', 'Emiri', '$2y$10$xOnZzdyNsfNjR8I0ZbIcYe7GAqBHnZbQZulU0.1mq8bAaifW/XypC', 2, NULL, NULL),
(7, 'Catherine', 'Grassart', 'cgssart', '$2y$10$1jUwKbvPv0FJsjQrDG6AH.RwUnwTthkUXAFShE0AnLhoFRkjvitG6', 1, NULL, NULL),
(8, 'cali', 'deccouture', 'Cali1234', '$2y$10$RxZ4KwFmUJkHVUyDSJzCn.aus01Xj35WxK2oNtJEz8TIGZvTHX/wm', 1, NULL, NULL),
(9, 'Maud', 'Fabre', 'Maudinette', '$2y$10$PABwHkJ7X15FbiTkZ87ya.UigJC9VKkZIonQo7AQmvHAARewrvhlK', 1, NULL, NULL),
(10, 'essaiprenom', 'essainom', 'essaipseudo', '$2y$10$iuBOYqtHj02FLtvjbBT.fuCTGLkpxsq6Sfgg8AA1o6mLqZF3loIgC', 2, NULL, NULL),
(12, 'essai1', 'essai1', 'essai1', '$2y$10$vb8E8iXRd4SGfnu1.8OncuxmGIWF3ZX8dTzYTw3IssRhr.WXVWKc6', 1, NULL, NULL),
(13, 'essai3', 'essai3', 'essai3', '$2y$10$Xb5aj/esfnGnwL2DsSglWuJx..CPmllENgFq2YAlYfSC2/Neo91Wq', 0, NULL, NULL),
(14, 'essai4', 'essai4', 'essai4', '$2y$10$WE754nR2YX5DqZkKRVDSCO3mrSHse7JAdOMcLYTcMMGcJFjJUR4UG', 0, NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `vente`
--

CREATE TABLE `vente` (
  `id_temp_vente` int(11) NOT NULL,
  `date` int(11) NOT NULL,
  `dateheure` varchar(255) NOT NULL,
  `id_vendeur` int(11) NOT NULL,
  `modif` tinyint(4) DEFAULT NULL,
  `id_modif` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Déchargement des données de la table `vente`
--

INSERT INTO `vente` (`id_temp_vente`, `date`, `dateheure`, `id_vendeur`, `modif`, `id_modif`) VALUES
(6, 1703332398, '23-12 12:53:18', 3, 0, NULL);

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `bilan`
--
ALTER TABLE `bilan`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `boutons_ventes`
--
ALTER TABLE `boutons_ventes`
  ADD PRIMARY KEY (`id_bouton`);

--
-- Index pour la table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `client`
--
ALTER TABLE `client`
  ADD PRIMARY KEY (`id_client`);

--
-- Index pour la table `commentaire`
--
ALTER TABLE `commentaire`
  ADD PRIMARY KEY (`id_comm`);

--
-- Index pour la table `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `fonction`
--
ALTER TABLE `fonction`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `inscription_creneau`
--
ALTER TABLE `inscription_creneau`
  ADD PRIMARY KEY (`id_inscription`);

--
-- Index pour la table `modifticketdecaisse`
--
ALTER TABLE `modifticketdecaisse`
  ADD PRIMARY KEY (`id_modif`) USING BTREE;

--
-- Index pour la table `objets_collectes`
--
ALTER TABLE `objets_collectes`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `objets_vendus`
--
ALTER TABLE `objets_vendus`
  ADD PRIMARY KEY (`id_achat`);

--
-- Index pour la table `objets_vendus_modif`
--
ALTER TABLE `objets_vendus_modif`
  ADD PRIMARY KEY (`id_objet_modif`);

--
-- Index pour la table `paiement_mixte`
--
ALTER TABLE `paiement_mixte`
  ADD PRIMARY KEY (`id_paiement_mixte`);

--
-- Index pour la table `paiement_mixte_modif`
--
ALTER TABLE `paiement_mixte_modif`
  ADD PRIMARY KEY (`id_paiement_mixte_modif`);

--
-- Index pour la table `projet`
--
ALTER TABLE `projet`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `reparation`
--
ALTER TABLE `reparation`
  ADD PRIMARY KEY (`id_rep`);

--
-- Index pour la table `taches`
--
ALTER TABLE `taches`
  ADD PRIMARY KEY (`id_tache`);

--
-- Index pour la table `ticketdecaisse`
--
ALTER TABLE `ticketdecaisse`
  ADD PRIMARY KEY (`id_ticket`);

--
-- Index pour la table `ticketdecaissetemp`
--
ALTER TABLE `ticketdecaissetemp`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `vente`
--
ALTER TABLE `vente`
  ADD PRIMARY KEY (`id_temp_vente`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `bilan`
--
ALTER TABLE `bilan`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `boutons_ventes`
--
ALTER TABLE `boutons_ventes`
  MODIFY `id_bouton` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=213;

--
-- AUTO_INCREMENT pour la table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=87;

--
-- AUTO_INCREMENT pour la table `client`
--
ALTER TABLE `client`
  MODIFY `id_client` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `commentaire`
--
ALTER TABLE `commentaire`
  MODIFY `id_comm` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT pour la table `events`
--
ALTER TABLE `events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1549;

--
-- AUTO_INCREMENT pour la table `fonction`
--
ALTER TABLE `fonction`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `inscription_creneau`
--
ALTER TABLE `inscription_creneau`
  MODIFY `id_inscription` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=121;

--
-- AUTO_INCREMENT pour la table `modifticketdecaisse`
--
ALTER TABLE `modifticketdecaisse`
  MODIFY `id_modif` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT pour la table `objets_collectes`
--
ALTER TABLE `objets_collectes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=351;

--
-- AUTO_INCREMENT pour la table `objets_vendus`
--
ALTER TABLE `objets_vendus`
  MODIFY `id_achat` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=473;

--
-- AUTO_INCREMENT pour la table `objets_vendus_modif`
--
ALTER TABLE `objets_vendus_modif`
  MODIFY `id_objet_modif` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `paiement_mixte`
--
ALTER TABLE `paiement_mixte`
  MODIFY `id_paiement_mixte` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT pour la table `paiement_mixte_modif`
--
ALTER TABLE `paiement_mixte_modif`
  MODIFY `id_paiement_mixte_modif` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `projet`
--
ALTER TABLE `projet`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT pour la table `reparation`
--
ALTER TABLE `reparation`
  MODIFY `id_rep` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT pour la table `taches`
--
ALTER TABLE `taches`
  MODIFY `id_tache` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT pour la table `ticketdecaisse`
--
ALTER TABLE `ticketdecaisse`
  MODIFY `id_ticket` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=304;

--
-- AUTO_INCREMENT pour la table `ticketdecaissetemp`
--
ALTER TABLE `ticketdecaissetemp`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT pour la table `vente`
--
ALTER TABLE `vente`
  MODIFY `id_temp_vente` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
