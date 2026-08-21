CREATE TABLE `book_names` (`id` int, `testament` int, `japanese` varchar(255), `english` varchar(255)) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
INSERT INTO `book_names` (`id`, `testament`, `japanese`, `english`) VALUES (1,1,'架空書','Synthetic Book');
CREATE TABLE `books` (`id` int, `version` int, `book_name_id` int, `chapter` int, `verse` int, `word` text) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
INSERT INTO `books` (`id`, `version`, `book_name_id`, `chapter`, `verse`, `word`) VALUES (1,1,1,1,1,'Synthetic one'),(2,1,1,1,3,'Synthetic three');
