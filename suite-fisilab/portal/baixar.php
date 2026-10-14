<?php
/**
 * Entrega o instalador de um programa (ou da suíte) e conta o download.
 *
 *   baixar.php?app=fisifoto   |   baixar.php?app=suite
 *
 * Só aceita slugs que existem no manifest.json, e só entrega o arquivo que o manifesto indica,
 * de dentro de downloads/: nada vindo da URL vira caminho de arquivo.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

$slug = isset($_GET['app']) ? (string) $_GET['app'] : '';
if (!preg_match('/^[a-z0-9-]{1,40}$/', $slug) || ($slug !== 'suite' && !app_info($slug))) {
    http_response_code(404);
    page_head('Programa não encontrado — Suíte FisiLab');
    echo '<section class="secao"><div class="largura"><h1>Programa não encontrado</h1><p><a href="./#programas">Voltar para a lista de programas</a></p></div></section>';
    page_foot();
    exit;
}

$r = release($slug);
$file = $r ? basename((string) ($r['file'] ?? '')) : '';
if ($file === '' || !preg_match('/^[A-Za-z0-9._-]+\.exe$/', $file)) {
    http_response_code(404);
    page_head('Instalador indisponível — Suíte FisiLab');
    echo '<section class="secao"><div class="largura"><h1>Instalador ainda não disponível</h1><p>Este programa ainda não tem um instalador publicado. <a href="./#programas">Voltar</a></p></div></section>';
    page_foot();
    exit;
}

$cfg = cfg();
if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') {
    count_download($slug);
}

if ($cfg['mode'] === 'redirect') {
    header('Location: ' . rtrim($cfg['redirect_base'], '/') . '/' . rawurlencode($file), true, 302);
    exit;
}

$path = rtrim($cfg['downloads_dir'], '/\\') . DIRECTORY_SEPARATOR . $file;
if (!is_file($path)) {
    http_response_code(404);
    page_head('Arquivo não encontrado — Suíte FisiLab');
    echo '<section class="secao"><div class="largura"><h1>Arquivo não encontrado no servidor</h1><p>Avise a equipe do FisiLab. <a href="./#programas">Voltar</a></p></div></section>';
    page_foot();
    exit;
}

// Arquivos grandes: sem limite de tempo, sem buffer de saída, sem compressão.
@set_time_limit(0);
@ini_set('zlib.output_compression', 'Off');
while (ob_get_level() > 0) {
    ob_end_clean();
}

header('Content-Type: application/vnd.microsoft.portable-executable');
header('Content-Disposition: attachment; filename="' . $file . '"');
header('Content-Length: ' . filesize($path));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=3600');
if (!empty($r['sha256'])) {
    header('Digest: sha-256=' . base64_encode((string) hex2bin($r['sha256'])));
}
if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
    exit;
}
readfile($path);
