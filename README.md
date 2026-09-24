# Flansland — aplicação local

Esta versão inclui a interface da Flansland e um backend local em Node.js.

## Requisitos

- Node.js 18 ou superior
- Nenhum pacote externo

## Rodar no Windows

Abra o PowerShell dentro desta pasta e execute:

```powershell
$env:ADMIN_PASSWORD="COLOQUE_SUA_SENHA_AQUI"
node server.js
```

Depois abra:

```text
http://localhost:3000
```

Painel administrativo:

```text
http://localhost:3000/admin
```

O único e-mail autorizado a criar o primeiro administrador é:

```text
rhuanprodutor3@gmail.com
```

Não coloque sua senha neste arquivo. Ela é lida apenas pela variável de ambiente no primeiro início.

## Rodar no CMD

```bat
set "ADMIN_PASSWORD=COLOQUE_SUA_SENHA_AQUI"
node server.js
```

## Funcionalidades incluídas

- Cadastro e login de usuários
- Sessão protegida por cookie
- Rota `/admin`
- Área do cliente em `/cliente`, separada da área administrativa
- Primeiro administrador limitado ao e-mail autorizado
- Criação de novos acessos pelo painel
- Notícias recentes em `/noticias`, com categoria e foto
- Loja separada em `/loja`, com busca, categorias, fotos e botão de interesse via Discord
- Criação e exclusão de itens da loja
- Servidores parceiros cadastrados no painel e exibidos em carrossel na página inicial
- Abas públicas de Equipe e Creators em `/comunidade`
- Página de regras em `/regras`, com texto editável pelo painel
- Rodapé com crédito circular para 𝓔𝓾𝓖𝓪𝓫𝓻𝓲𝓮𝓵𝓵
- Configurações editáveis do aviso, IP, nome do site e Discord
- Integração para plugin Minecraft registrar entradas de jogadores
- Arquivo `data.json` criado automaticamente para armazenar os dados

## Rotas

```text
/          Página inicial
/noticias  Notícias recentes
/loja      Loja por categorias
/cliente   Área privada do jogador conectado
/comunidade Equipe e Creators
/regras     Regras
/admin     Painel administrativo protegido
```

## API do plugin Minecraft

Configure uma chave fora do código antes de iniciar o servidor:

```powershell
$env:MINECRAFT_API_KEY="SUA_CHAVE_DO_PLUGIN"
node server.js
```

O plugin deve enviar um `POST` para:

```text
http://localhost:3000/api/minecraft/player-join
```

Com o header:

```text
x-api-key: SUA_CHAVE_DO_PLUGIN
```

E um JSON como:

```json
{
  "nick": "Jogador",
  "uuid": "uuid-do-jogador",
  "accountEmail": "jogador@email.com",
  "onlinePlayers": 12,
  "maxPlayers": 500
}
```

O endpoint `player-join` salva o nick e a data e hora da entrada. O endpoint `heartbeat` atualiza somente o total atual de jogadores e o limite máximo, sem criar uma entrada falsa. Se o nick ou e-mail estiver vinculado a uma conta, a última entrada também aparece no perfil do jogador e na página inicial.

### Heartbeat automático no plugin Paper/Spigot

Envie o heartbeat a cada 30 segundos. Se o site não receber uma atualização por 90 segundos, a API marca o servidor como offline e retorna `online: 0`, evitando mostrar uma quantidade antiga de jogadores.

Exemplo de tarefa para adicionar na classe principal do plugin:

```java
private final HttpClient httpClient = HttpClient.newHttpClient();
private final String apiUrl = "https://SEU-DOMINIO.com";
private final String apiKey = System.getenv("FLANSLAND_API_KEY");

@Override
public void onEnable() {
    new BukkitRunnable() {
        @Override
        public void run() {
            int online = Bukkit.getOnlinePlayers().size();
            int max = Bukkit.getMaxPlayers();

            String json = "{\"onlinePlayers\":" + online + ",\"maxPlayers\":" + max + "}";
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl + "/api/minecraft/heartbeat"))
                .header("Content-Type", "application/json")
                .header("x-api-key", apiKey)
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .exceptionally(error -> {
                    getLogger().warning("Não foi possível enviar o status para a Flansland: " + error.getMessage());
                    return null;
                });
        }
    }.runTaskTimer(this, 0L, 20L * 30L);
}
```

Imports necessários:

```java
import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitRunnable;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
```

Rota pública para o site ou outro sistema consultar:

```text
GET https://SEU-DOMINIO.com/api/minecraft/status
```

Resposta:

```json
{
  "online": 12,
  "max": 500,
  "onlinePlayers": 12,
  "maxPlayers": 500,
  "isOnline": true,
  "stale": false,
  "updatedAt": "2026-09-16T12:00:00.000Z"
}
```

## Widget e login com Discord/Google

O site inclui um widget oficial do Discord, com canais e membros online, e botões de login/cadastro com Google e Discord. O widget usa por padrão o ID do servidor encontrado nos links da comunidade:

```text
DISCORD_SERVER_ID=1549100473506734160
```

No Discord, ative **Server Settings → Widget → Enable Server Widget** para o painel aparecer. Se o ID do seu servidor for outro, substitua essa variável.

Para ativar os botões OAuth, configure as variáveis abaixo no ambiente do servidor:

```powershell
$env:PUBLIC_URL="https://SEU-DOMINIO.com"
$env:GOOGLE_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
$env:GOOGLE_CLIENT_SECRET="seu-client-secret"
$env:DISCORD_CLIENT_ID="seu-client-id"
$env:DISCORD_CLIENT_SECRET="seu-client-secret"
node server.js
```

No painel do Google OAuth, adicione esta URI de redirecionamento:

```text
https://SEU-DOMINIO.com/auth/google/callback
```

No Developer Portal do Discord, adicione:

```text
https://SEU-DOMINIO.com/auth/discord/callback
```

Para testar localmente, troque `PUBLIC_URL` por `http://localhost:3000` e cadastre as duas URLs locais nos respectivos painéis. Os segredos devem ficar somente nas variáveis de ambiente ou nos Secrets da hospedagem, nunca dentro do ZIP ou do código.

## Importante

Esta é uma versão local com armazenamento em JSON. Para publicar na internet, o próximo passo recomendado é trocar o arquivo JSON por PostgreSQL ou MySQL, adicionar HTTPS e configurar recuperação de senha, proteção contra tentativas repetidas e backup.