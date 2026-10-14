<?php
/**
 * Configuração do portal de downloads da Suíte FisiLab.
 *
 * Copie este arquivo para config.local.php e ajuste lá: config.local.php não é sobrescrito quando
 * o portal é atualizado (e está no .gitignore).
 */

return [
    // Endereço público do portal, sem barra no fim (usado em links absolutos e no og:url).
    'base_url' => 'https://www.ufrgs.br/fisilab/suite',

    // De onde vêm os instaladores:
    //  'local'    -> arquivos em downloads/ neste servidor (recomendado; o PHP entrega o arquivo).
    //  'redirect' -> redireciona para 'redirect_base' + nome do arquivo (ex.: GitHub Releases ou
    //                outro servidor de arquivos da UFRGS).
    'mode' => 'local',
    'downloads_dir' => __DIR__ . '/downloads',
    'redirect_base' => 'https://github.com/mrcandrade/larfic/releases/latest/download/',

    // Onde o portal guarda a contagem de downloads (precisa ser gravável pelo PHP e NÃO público).
    'data_dir' => __DIR__ . '/dados',

    // Senha (token) para ver estatisticas.php?token=... Troque por um valor longo e aleatório.
    'stats_token' => 'troque-este-token',

    // Contato exibido no rodapé.
    'contact_email' => 'fisilab@ufrgs.br',

    // Links
    'repo_url' => 'https://github.com/mrcandrade/larfic/tree/main/suite-fisilab',
    'github_owner' => 'mrcandrade',
    'cta_url' => 'https://cta.if.ufrgs.br',
    'ufrgs_url' => 'https://www.ufrgs.br',
];
