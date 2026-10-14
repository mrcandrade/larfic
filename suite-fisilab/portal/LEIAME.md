# Portal de downloads da Suíte FisiLab — implantação

Um site PHP simples, sem banco de dados e sem dependências, para hospedar os instaladores no
servidor da UFRGS. Mostra os programas, conta os downloads, publica o manifesto e os créditos.

## Requisitos

- PHP **7.4 ou superior** (testado no 8.4), sem extensões especiais.
- Apache 2.4 com `.htaccess` habilitado (`AllowOverride All`) **ou** nginx (configuração abaixo).
- Espaço em disco: cerca de 2× o tamanho dos instaladores (a suíte completa mais os individuais).
- Limites do PHP: o download é transmitido em fluxo (`readfile`), então `memory_limit` não precisa
  crescer; o script desliga o limite de tempo durante o download.

## Passo a passo

1. Gere os instaladores e monte o portal (no Windows, na pasta `suite-fisilab`):

   ```powershell
   powershell -ExecutionPolicy Bypass -File installer\build-installers.ps1
   powershell -ExecutionPolicy Bypass -File scripts\publicar-portal.ps1
   ```

2. Envie `dist/portal/` para o servidor, por exemplo para `/var/www/fisilab/suite/`:

   ```bash
   rsync -av --exclude config.local.php --exclude dados/downloads.json \
         dist/portal/ usuario@servidor.ufrgs.br:/var/www/fisilab/suite/
   ```

3. No servidor, crie `config.local.php` (não é sobrescrito nas atualizações):

   ```php
   <?php
   return [
       'base_url'      => 'https://www.ufrgs.br/fisilab/suite',
       'stats_token'   => 'COLOQUE-AQUI-UM-TOKEN-LONGO-E-ALEATORIO',
       'contact_email' => 'fisilab@ufrgs.br',
   ];
   ```

   Gere um token com `openssl rand -hex 24`.

4. Dê ao PHP permissão de escrita **apenas** na pasta `dados/` (contagem de downloads):

   ```bash
   chown -R www-data:www-data /var/www/fisilab/suite/dados
   chmod 750 /var/www/fisilab/suite/dados
   ```

5. Acesse a página e teste um download. As estatísticas ficam em
   `estatisticas.php?token=<seu token>`.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.php` | Página principal: suíte completa, os 12 programas, manifesto, créditos, ajuda |
| `baixar.php?app=<nome>` | Entrega o instalador e conta o download (`app=suite` para a suíte completa) |
| `manifesto.php` | O manifesto, lido de `dados/MANIFESTO.md` |
| `estatisticas.php` | Contagem de downloads por programa e mês (protegida por token) |
| `config.php` | Configuração padrão; ajuste em `config.local.php` |
| `dados/apps.json` | Catálogo (nomes, descrições, equivalentes, projeto de origem) |
| `downloads/manifest.json` | Versões, arquivos, tamanhos e SHA-256 (gerado pelo build) |
| `downloads/*.exe` | Os instaladores |

`dados/` e `downloads/` não são acessíveis diretamente pelo navegador: o `.htaccess` bloqueia, e
os instaladores só saem por `baixar.php`, que também confere se o nome do arquivo está no
manifesto.

## Instaladores em outro servidor

Se os arquivos `.exe` ficarem em outro lugar (outro servidor de arquivos da UFRGS ou GitHub
Releases), use em `config.local.php`:

```php
'mode' => 'redirect',
'redirect_base' => 'https://arquivos.ufrgs.br/fisilab/',
```

O portal continua contando os downloads e redireciona para `redirect_base` + nome do arquivo.
O `downloads/manifest.json` continua sendo necessário no servidor do portal.

## nginx

```nginx
location /fisilab/suite/ {
    index index.php;
    location ~ ^/fisilab/suite/(dados|downloads)/ { deny all; }
    location ~ ^/fisilab/suite/(config|config\.local|lib)\.php$ { deny all; }
    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $request_filename;
        fastcgi_pass unix:/run/php/php-fpm.sock;
        fastcgi_read_timeout 3600;
    }
}
```

## Atualizar uma versão

Gere de novo os instaladores (só os que mudaram: `-Apps fisifoto`), rode `publicar-portal.ps1` e
envie com o mesmo `rsync`. O manifesto sempre aponta para o instalador mais recente de cada
programa; apague do servidor os `.exe` antigos quando quiser.
