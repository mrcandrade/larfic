<?php
/** Contagem de downloads: estatisticas.php?token=<stats_token do config>. */
declare(strict_types=1);
require __DIR__ . '/lib.php';

$token = (string) ($_GET['token'] ?? '');
$expected = (string) cfg()['stats_token'];
if ($expected === '' || $expected === 'troque-este-token' || !hash_equals($expected, $token)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Acesso negado. Defina 'stats_token' em config.local.php e use estatisticas.php?token=...\n";
    exit;
}
header('X-Robots-Tag: noindex');

$counts = download_counts();
$rows = [['suite', 'Suíte FisiLab (completa)']];
foreach (catalog()['apps'] ?? [] as $a) {
    $rows[] = [$a['slug'], $a['name']];
}
$months = [];
foreach ($counts as $c) {
    foreach (array_keys($c['meses'] ?? []) as $m) {
        $months[$m] = true;
    }
}
krsort($months);
$months = array_slice(array_keys($months), 0, 6);
$total = 0;

page_head('Estatísticas — Suíte FisiLab');
?>
<section class="secao">
  <div class="largura">
    <h1>Downloads</h1>
    <div class="tabela-rolagem">
      <table class="tabela">
        <thead><tr><th>Programa</th><?php foreach ($months as $m): ?><th><?= e($m) ?></th><?php endforeach; ?><th>Total</th></tr></thead>
        <tbody>
        <?php foreach ($rows as [$slug, $name]):
            $c = $counts[$slug] ?? [];
            $total += (int) ($c['total'] ?? 0); ?>
          <tr>
            <td><?= e($name) ?></td>
            <?php foreach ($months as $m): ?><td><?= (int) ($c['meses'][$m] ?? 0) ?></td><?php endforeach; ?>
            <td><strong><?= (int) ($c['total'] ?? 0) ?></strong></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
        <tfoot><tr><th>Total</th><?php foreach ($months as $m): ?><th></th><?php endforeach; ?><th><?= $total ?></th></tr></tfoot>
      </table>
    </div>
    <p class="nota">Contagem de cliques em "Baixar" (não identifica pessoas). Manifesto gerado em
    <?= e((string) (manifest()['generated'] ?? '—')) ?>.</p>
  </div>
</section>
<?php page_foot();
