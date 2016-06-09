<?php
/**
 * receive.php
 *
 * A simple server-side script to interact with AuO for saving audio clips to a server. Update
 * $HOSTNAME to match the server's hostname and this file is all good to go. Just ensure that the
 * script has the requisite permissions to write to the server.
 */

$HOSTNAME = "https://localhost";  // Set this differently if you have a different host server.

// Make sure that the script has write permissions here!
if (!is_dir("sounds")) {
    `mkdir sounds`;
}

// Necessary for cross-origin requests, if AuO is hosted under a different host name than this
// script.
header('Access-Control-Allow-Headers: content-type');
header('Access-Control-Allow-Origin: *');

// Content type information.
$content_type = $_SERVER["CONTENT_TYPE"];
preg_match('/^audio\/([^; ]+); codecs=([^ ]+)/', $content_type, $content_type_matches);
$save_format = $content_type_matches[1];

$raw = file_get_contents('php://input');

// Create a unique filename by md5 hashing.
$counter = 0;
do {
    $filename = md5(date('U') . $raw . (++$counter)) . ".$save_format";
} while (file_exists("sounds/$filename"));

file_put_contents("sounds/$filename", $raw);

// Will generate the correct link to the saved audio file.
$link = substr($_SERVER["PHP_SELF"], 0, strrpos($_SERVER["PHP_SELF"], "/"));
$link = "$HOSTNAME$link/sounds/$filename";

echo $link;
?>
