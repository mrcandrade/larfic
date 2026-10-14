<?php
/**
 * O manifesto, lido de dados/MANIFESTO.md (cópia do suite-fisilab/MANIFESTO.md feita pelo
 * publicar-portal.ps1) e convertido com um conversor de Markdown mínimo: títulos, listas,
 * parágrafos, negrito, itálico, código e links. Blocos HTML do arquivo (logos) são ignorados,
 * porque a página já tem cabeçalho e rodapé próprios.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

function md_inline(string $s): string
{
    $s = e($s);
    $s = preg_replace('/`([^`]+)`/', '<code>$1</code>', $s);
    $s = preg_replace('/\*\*([^*]+)\*\*/', '<strong>$1</strong>', $s);
    $s = preg_replace('/(?<![*\w])\*([^*]+)\*(?!\*)/', '<em>$1</em>', $s);
    $s = preg_replace('/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/', '<a href="$2">$1</a>', $s);
    return (string) $s;
}

function md_to_html(string $md): string
{
    $out = [];
    $para = [];
    $list = null; // 'ul' | 'ol'
    $flushPara = function () use (&$para, &$out) {
        if ($para) {
            $out[] = '<p>' . md_inline(implode(' ', $para)) . '</p>';
            $para = [];
        }
    };
    $closeList = function () use (&$list, &$out) {
        if ($list) {
            $out[] = "</$list>";
            $list = null;
        }
    };
    $inHtml = false;
    foreach (preg_split('/\r?\n/', $md) as $line) {
        $t = trim($line);
        if ($inHtml) {
            if ($t === '' || preg_match('#</(p|div)>$#', $t)) {
                $inHtml = false;
            }
            continue;
        }
        if ($t !== '' && $t[0] === '<') {
            $flushPara();
            $closeList();
            $inHtml = !preg_match('#</(p|div|h1)>$#', $t);
            continue;
        }
        if ($t === '' || $t === '---') {
            $flushPara();
            if ($t === '---') {
                $closeList();
            }
            continue;
        }
        if (preg_match('/^(#{1,3})\s+(.*)$/', $t, $m)) {
            $flushPara();
            $closeList();
            $level = max(2, strlen($m[1])); // a página já tem um h1
            $out[] = "<h$level>" . md_inline($m[2]) . "</h$level>";
            continue;
        }
        if (preg_match('/^(-|\d+\.)\s+(.*)$/', $t, $m)) {
            $flushPara();
            $type = $m[1] === '-' ? 'ul' : 'ol';
            if ($list !== $type) {
                $closeList();
                $start = ($type === 'ol' && (int) $m[1] !== 1) ? ' start="' . (int) $m[1] . '"' : '';
                $out[] = "<$type$start>";
                $list = $type;
            }
            $out[] = '<li>' . md_inline($m[2]) . '</li>';
            continue;
        }
        if ($list && preg_match('/^\s{2,}\S/', $line)) {
            // continuação do item de lista anterior
            $last = array_pop($out);
            $out[] = substr($last, 0, -5) . ' ' . md_inline($t) . '</li>';
            continue;
        }
        $closeList();
        $para[] = $t;
    }
    $flushPara();
    $closeList();
    return implode("\n", $out);
}

$path = __DIR__ . '/dados/MANIFESTO.md';
$html = is_file($path) ? md_to_html((string) file_get_contents($path)) : '<p>Manifesto indisponível.</p>';

page_head('Manifesto pelas Tecnologias Livres — Suíte FisiLab',
    'Por que a UFRGS deve usar e produzir tecnologias livres: o manifesto da Suíte FisiLab.');
?>
<article class="secao">
  <div class="largura texto-longo">
    <p class="sobretitulo">Suíte FisiLab · FisiLab — LARFIC · UFRGS · em parceria com o CTA</p>
    <h1>Manifesto pelas Tecnologias Livres</h1>
    <?= $html ?>
    <p class="nota">Este manifesto pode ser copiado, adaptado e redistribuído livremente (CC BY-SA 4.0).</p>
  </div>
</article>
<?php page_foot();
