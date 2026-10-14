<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';

$apps = catalog()['apps'] ?? [];
$suite = release('suite');
$owner = cfg()['github_owner'];

// Agrupa por categoria, na ordem em que aparecem no catálogo.
$groups = [];
foreach ($apps as $a) {
    $groups[$a['category']][] = $a;
}

page_head('Suíte FisiLab — programas livres para a UFRGS');
?>
<section class="hero">
  <div class="largura hero-grade">
    <div>
      <p class="sobretitulo">FisiLab — LARFIC · UFRGS <span aria-hidden="true">·</span> em parceria com o CTA</p>
      <h1>Programas livres para estudar, ensinar e criar.</h1>
      <p class="lead">A Suíte FisiLab reúne <?= count($apps) ?> programas de código aberto para editar
      imagens, vídeos e áudio, escrever documentos, montar planilhas e apresentações, trabalhar com
      PDF e fazer desenho técnico. São gratuitos, em português e sem rastreamento. Para estudantes,
      professores e técnicos da UFRGS.</p>
      <div class="acoes">
        <?php if ($suite): ?>
          <a class="botao primario" href="baixar.php?app=suite">
            Baixar a suíte completa
            <small><?= e(human_size((int) $suite['size'])) ?> · Windows 10/11 (64 bits)</small>
          </a>
        <?php else: ?>
          <span class="botao primario desabilitado">Instaladores em preparação</span>
        <?php endif; ?>
        <a class="botao" href="#programas">Escolher programas</a>
      </div>
      <p class="nota">Instala sem senha de administrador. Você escolhe quais programas quer na
      instalação.</p>
    </div>
    <div class="hero-logo" aria-hidden="true">
      <img src="assets/larfic-logo.png" alt="" width="320" height="320">
    </div>
  </div>
</section>

<section id="programas" class="secao">
  <div class="largura">
    <h2>Programas</h2>
    <p class="secao-intro">Cada programa também pode ser baixado e instalado separadamente. Em
    destaque, o programa comercial que ele substitui.</p>

    <?php foreach ($groups as $category => $list): ?>
      <h3 class="categoria"><?= e($category) ?></h3>
      <ul class="cartoes">
        <?php foreach ($list as $a):
            $r = release($a['slug']); ?>
          <li class="cartao" id="<?= e($a['slug']) ?>">
            <div class="cartao-topo">
              <img src="assets/icons/<?= e($a['slug']) ?>-128.png" alt="" width="56" height="56" loading="lazy">
              <div>
                <h4><?= e($a['name']) ?></h4>
                <p class="tagline"><?= e($a['tagline']) ?></p>
              </div>
            </div>
            <p class="equivalente">Alternativa livre ao <strong><?= e($a['equivalent']) ?></strong></p>
            <p class="descricao"><?= e($a['description']) ?></p>
            <div class="cartao-rodape">
              <?php if ($r): ?>
                <a class="botao pequeno primario" href="baixar.php?app=<?= e($a['slug']) ?>"
                   aria-label="Baixar o <?= e($a['name']) ?>">Baixar</a>
                <span class="meta">v<?= e($r['version']) ?> · <?= e(human_size((int) $r['size'])) ?></span>
              <?php else: ?>
                <span class="meta">Em breve</span>
              <?php endif; ?>
            </div>
            <details class="detalhes">
              <summary>Detalhes e verificação</summary>
              <p>Baseado no <a href="https://github.com/storytold/<?= e($a['upstream_slug']) ?>"><?= e($a['upstream']) ?></a>
              (ArtCraft Team e contribuidores). Código-fonte desta versão:
              <a href="https://github.com/<?= e($owner) ?>/<?= e($a['slug']) ?>">github.com/<?= e($owner) ?>/<?= e($a['slug']) ?></a>.</p>
              <?php if ($r): ?>
                <p>Arquivo: <code><?= e($r['file']) ?></code> (<?= e(human_date($r['date'])) ?>)<br>
                SHA-256: <code class="hash"><?= e($r['sha256']) ?></code></p>
              <?php endif; ?>
            </details>
          </li>
        <?php endforeach; ?>
      </ul>
    <?php endforeach; ?>
  </div>
</section>

<section class="secao faixa">
  <div class="largura manifesto-resumo">
    <h2>Por que software livre?</h2>
    <p>Conhecimento produzido em uma universidade pública deve circular livremente. Por isso, as
    ferramentas que usamos para ensinar, pesquisar e criar também devem ser livres: qualquer pessoa
    pode usá-las, estudá-las, modificá-las e compartilhá-las. Assim ninguém precisa pagar para
    aprender, e os arquivos continuam acessíveis daqui a vinte anos.</p>
    <a class="botao" href="manifesto.php">Ler o manifesto</a>
  </div>
</section>

<section id="creditos" class="secao">
  <div class="largura">
    <h2>Créditos</h2>
    <p>Os programas da Suíte FisiLab <strong>não foram escritos do zero pelo FisiLab</strong>. São
    versões modificadas de projetos de código aberto criados pelo <strong>ArtCraft Team</strong> e
    por seus contribuidores, publicados sob as licenças MIT e Apache 2.0. Todo o trabalho de edição,
    formatos de arquivo e ferramentas é deles. O FisiLab adaptou o nome, a identidade visual, o tema
    de cores, a tela de abertura, os textos em português e o instalador, e distribui a suíte para a
    comunidade da UFRGS.</p>
    <div class="tabela-rolagem">
      <table class="tabela">
        <thead><tr><th>Programa</th><th>Baseado em</th><th>Substitui</th><th>Licença</th></tr></thead>
        <tbody>
          <?php foreach ($apps as $a): ?>
            <tr>
              <td><a href="#<?= e($a['slug']) ?>"><?= e($a['name']) ?></a></td>
              <td><a href="https://github.com/storytold/<?= e($a['upstream_slug']) ?>"><?= e($a['upstream']) ?></a></td>
              <td><?= e($a['equivalent']) ?></td>
              <td>MIT ou Apache 2.0</td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <p class="nota">Os nomes de produtos comerciais citados (Adobe, Microsoft, Autodesk, Avid e
    seus programas) são marcas de seus titulares e aparecem apenas para indicar a finalidade de
    cada programa.</p>
  </div>
</section>

<section id="ajuda" class="secao faixa">
  <div class="largura">
    <h2>Ajuda</h2>
    <div class="faq">
      <details>
        <summary>Quais são os requisitos?</summary>
        <p>Windows 10 ou 11 de 64 bits. Os programas usam a placa de vídeo para desenhar a
        interface; em computadores muito antigos, atualize o driver de vídeo. Para macOS e Linux,
        é possível compilar a partir do <a href="<?= e(cfg()['repo_url']) ?>">código-fonte</a>.</p>
      </details>
      <details>
        <summary>O Windows mostrou "O Windows protegeu o computador". É seguro?</summary>
        <p>Esse aviso (SmartScreen) aparece em programas novos que ainda não têm reputação. Clique
        em <em>Mais informações</em> e depois em <em>Executar assim mesmo</em>. Se quiser
        conferir que o arquivo é o original, compare o SHA-256 mostrado em <em>Detalhes e
        verificação</em> com o resultado de <code>Get-FileHash arquivo.exe</code> no PowerShell.</p>
      </details>
      <details>
        <summary>Preciso de senha de administrador?</summary>
        <p>Não. Por padrão, a instalação é feita só para o seu usuário. Quem administra laboratórios
        pode escolher "instalar para todos os usuários" no início do assistente, ou instalar sem
        interação com <code>/VERYSILENT /ALLUSERS</code>.</p>
      </details>
      <details>
        <summary>Como desinstalar ou atualizar?</summary>
        <p>Cada programa aparece separadamente em <em>Configurações › Aplicativos</em>. Para
        atualizar, baixe e execute o instalador da versão nova; suas preferências são mantidas.</p>
      </details>
      <details>
        <summary>Encontrei um problema. Onde aviso?</summary>
        <p>Abra uma <em>issue</em> no repositório do programa (o link está em <em>Detalhes e
        verificação</em>) ou escreva para <a href="mailto:<?= e(cfg()['contact_email']) ?>"><?= e(cfg()['contact_email']) ?></a>.</p>
      </details>
    </div>
  </div>
</section>
<?php page_foot();
