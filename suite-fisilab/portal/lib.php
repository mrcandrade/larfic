<?php
/**
 * Funções compartilhadas do portal: configuração, catálogo, manifesto de downloads e contador.
 * Compatível com PHP 7.4+.
 */

declare(strict_types=1);

function cfg(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require __DIR__ . '/config.php';
        $local = __DIR__ . '/config.local.php';
        if (is_file($local)) {
            $cfg = array_replace($cfg, require $local);
        }
    }
    return $cfg;
}

/** Escapa texto para HTML. */
function e($s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function read_json(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : [];
}

/** O catálogo (nomes, descrições, equivalentes, projeto de origem). */
function catalog(): array
{
    static $c = null;
    if ($c === null) {
        $c = read_json(__DIR__ . '/dados/apps.json');
    }
    return $c;
}

/** O manifesto gerado pelo build-installers.ps1 (versões, arquivos, tamanhos, SHA-256). */
function manifest(): array
{
    static $m = null;
    if ($m === null) {
        $m = read_json(rtrim(cfg()['downloads_dir'], '/\\') . '/manifest.json');
    }
    return $m;
}

/** A entrada de download de um app (ou 'suite'), ou null. */
function release(string $slug): ?array
{
    $m = manifest();
    if ($slug === 'suite') {
        return isset($m['suite']) && is_array($m['suite']) ? $m['suite'] : null;
    }
    foreach ($m['apps'] ?? [] as $r) {
        if (($r['slug'] ?? '') === $slug) {
            return $r;
        }
    }
    return null;
}

function app_info(string $slug): ?array
{
    foreach (catalog()['apps'] ?? [] as $a) {
        if (($a['slug'] ?? '') === $slug) {
            return $a;
        }
    }
    return null;
}

function human_size(int $bytes): string
{
    if ($bytes >= 1073741824) {
        return number_format($bytes / 1073741824, 1, ',', '.') . ' GB';
    }
    if ($bytes >= 1048576) {
        return number_format($bytes / 1048576, 0, ',', '.') . ' MB';
    }
    return number_format(max(1, $bytes / 1024), 0, ',', '.') . ' KB';
}

function human_date(string $iso): string
{
    $t = strtotime($iso);
    return $t ? date('d/m/Y', $t) : '';
}

/** Soma 1 ao contador de downloads do slug (arquivo JSON com trava). Nunca derruba o download. */
function count_download(string $slug): void
{
    $dir = cfg()['data_dir'];
    if (!is_dir($dir) && !@mkdir($dir, 0750, true)) {
        return;
    }
    $file = $dir . '/downloads.json';
    $fh = @fopen($file, 'c+');
    if (!$fh) {
        return;
    }
    if (flock($fh, LOCK_EX)) {
        $raw = stream_get_contents($fh);
        $data = json_decode($raw ?: '{}', true);
        if (!is_array($data)) {
            $data = [];
        }
        $month = date('Y-m');
        $data[$slug]['total'] = ($data[$slug]['total'] ?? 0) + 1;
        $data[$slug]['meses'][$month] = ($data[$slug]['meses'][$month] ?? 0) + 1;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        fflush($fh);
        flock($fh, LOCK_UN);
    }
    fclose($fh);
}

function download_counts(): array
{
    return read_json(cfg()['data_dir'] . '/downloads.json');
}

/** Cabeçalho HTML comum. */
function page_head(string $title, string $description = ''): void
{
    $c = cfg();
    $desc = $description ?: 'Programas livres para estudantes, professores e técnicos da UFRGS. Disponibilizado pelo FisiLab em parceria com o CTA.';
    ?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($title) ?></title>
<meta name="description" content="<?= e($desc) ?>">
<meta property="og:title" content="<?= e($title) ?>">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= e($c['base_url']) ?>">
<meta property="og:image" content="<?= e($c['base_url']) ?>/assets/larfic-logo.png">
<meta name="theme-color" content="#1A2532">
<link rel="icon" href="assets/favicon.png" type="image/png">
<link rel="stylesheet" href="assets/estilo.css?v=1">
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo">
  <div class="largura topo-linha">
    <a class="marca" href="./">
      <img src="assets/larfic-logo.png" alt="" width="40" height="40">
      <span><strong>Suíte FisiLab</strong><small>FisiLab — LARFIC · UFRGS</small></span>
    </a>
    <nav aria-label="Principal">
      <a href="./#programas">Programas</a>
      <a href="manifesto.php">Manifesto</a>
      <a href="./#creditos">Créditos</a>
      <a href="./#ajuda">Ajuda</a>
    </nav>
  </div>
</header>
<main id="conteudo">
<?php
}

/** Rodapé HTML comum. */
function page_foot(): void
{
    $c = cfg();
    ?>
</main>
<footer class="rodape">
  <div class="largura rodape-grade">
    <div>
      <p><strong>Suíte FisiLab</strong> — disponibilizada pelo <strong>FisiLab — LARFIC · UFRGS</strong>
      (Laboratório de Robótica, Inteligência Artificial e Física Computacional) em parceria com o
      <strong>CTA — Centro de Tecnologia Acadêmica</strong>.</p>
      <p>Para uso de estudantes, professores e técnicos da UFRGS.</p>
      <p>Os programas são versões modificadas de projetos de código aberto do ArtCraft Team e de seus
      contribuidores, sob as licenças MIT e Apache 2.0. Os nomes e marcas dos projetos originais
      pertencem aos seus titulares; esta suíte não é afiliada nem endossada por eles.</p>
      <p><a href="<?= e($c['repo_url']) ?>">Código-fonte</a> · <a href="manifesto.php">Manifesto</a> ·
      <a href="mailto:<?= e($c['contact_email']) ?>"><?= e($c['contact_email']) ?></a></p>
    </div>
    <div class="parceiros">
      <a href="<?= e($c['ufrgs_url']) ?>"><img src="assets/ufrgs-logo.gif" alt="UFRGS" height="52"></a>
      <a href="<?= e($c['cta_url']) ?>"><img src="assets/cta-logo.webp" alt="CTA — Centro de Tecnologia Acadêmica" height="44"></a>
    </div>
  </div>
</footer>
</body>
</html>
<?php
}
