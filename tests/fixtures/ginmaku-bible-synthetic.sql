CREATE TABLE `book_names` (
  `id` int(11) NOT NULL,
  `testament` int(11) DEFAULT NULL,
  `japanese` varchar(255) DEFAULT NULL,
  `english` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
INSERT INTO `book_names` (`id`, `testament`, `japanese`, `english`)
VALUES
  (1,1,'架空書','Synthetic Book');
CREATE TABLE `books` (
  `id` int(11) NOT NULL,
  `version` int(11) DEFAULT NULL,
  `book_name_id` int(11) DEFAULT NULL,
  `chapter` int(11) DEFAULT NULL,
  `verse` int(11) DEFAULT NULL,
  `word` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
INSERT INTO `books` (`id`, `version`, `book_name_id`, `chapter`, `verse`, `word`)
VALUES
  (1,1,1,1,1,'架空の本文'),
  (2,1,1,1,3,''),
  (3,2,1,1,1,'Synthetic text'),
  (4,2,1,1,1,'Duplicate synthetic text');
