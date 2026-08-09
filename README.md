# Mapa Vivo 🗺️📷

App web (funciona em celular e desktop, hospedado gratuitamente no **GitHub Pages**) onde o mapa é a tela principal:
- Sua localização aparece com sua **foto de perfil redonda dentro de um quadrado**.
- Ao tirar uma foto pela câmera, ela é **salva com título, descrição, data/hora, localização e clima do momento**, e aparece no mapa no local onde foi tirada.
- Você pode **buscar fotos por título/descrição** ou encontrá-las diretamente no mapa.
- Você pode ver **pessoas próximas no mapa**, abrir o perfil delas, **curtir, comentar, compartilhar e conversar** por chat.
- Você pode **criar eventos no mapa** para divulgar uma foto postada recentemente.
- Login, cadastro, exclusão de conta e **troca de idioma (PT/EN/ES)** inclusos.

Tudo funciona sem servidor próprio: o **Firebase** (gratuito no plano Spark, dentro dos limites do dia a dia) cuida de login, banco de dados e armazenamento de imagens. O mapa usa **OpenStreetMap/Leaflet**, que não exige chave de API.

---

## 1. Criar o projeto no Firebase (grátis)

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**.
2. Dê um nome (ex: `mapa-vivo`) e conclua a criação.
3. No menu lateral, ative:
   - **Build → Authentication** → aba "Sign-in method" → ative **E-mail/senha**.
   - **Build → Firestore Database** → "Criar banco de dados" → modo produção → escolha a região mais próxima.
   - **Build → Storage** → "Começar" → modo produção.
4. Em **Configurações do projeto (⚙️) → Geral → Seus apps**, clique no ícone `</>` (Web), registre o app (não precisa marcar Hosting) e copie o objeto `firebaseConfig` que aparece.
5. Cole esse objeto no arquivo [`js/firebase-config.js`](js/firebase-config.js), substituindo os valores de exemplo.

## 2. Regras de segurança

### Firestore (Build → Firestore Database → Regras)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    match /photos/{photoId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update: if request.auth != null; // permite curtidas/contadores de qualquer usuário logado
      allow delete: if request.auth != null && resource.data.uid == request.auth.uid;

      match /comments/{commentId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      }
    }

    match /events/{eventId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
    }

    match /chats/{chatId} {
      allow read, write: if request.auth != null && request.auth.uid in resource.data.participants;
      allow create: if request.auth != null && request.auth.uid in request.resource.data.participants;

      match /messages/{messageId} {
        allow read, create: if request.auth != null;
      }
    }
  }
}
```

### Storage (Build → Storage → Regras)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile_photos/{uid}.jpg {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /photos/{uid}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

> Essas regras são um bom ponto de partida. Antes de divulgar o app publicamente, revise-as com calma (ex.: limitar tamanho de upload, moderação de conteúdo).

## 3. Rodar localmente

Como o app usa módulos JavaScript (`type="module"`), abrir o `index.html` direto no navegador (`file://`) não funciona. Use um servidor local simples:

```bash
cd mapa-fotos-social
python3 -m http.server 8080
# ou: npx serve .
```

Depois acesse `http://localhost:8080`.

## 4. Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (ex: `mapa-vivo`).
2. Envie os arquivos deste projeto para o repositório:
   ```bash
   cd mapa-fotos-social
   git init
   git add .
   git commit -m "Primeira versão do Mapa Vivo"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/mapa-vivo.git
   git push -u origin main
   ```
3. No GitHub, vá em **Settings → Pages**.
4. Em "Source", selecione a branch `main` e a pasta `/ (root)`.
5. Salve. Em alguns minutos o app estará em `https://SEU_USUARIO.github.io/mapa-vivo/`.
6. No Firebase, vá em **Authentication → Settings → Domínios autorizados** e adicione `SEU_USUARIO.github.io`.

O site precisa ser aberto em HTTPS (o GitHub Pages já entrega isso) para a câmera e a geolocalização funcionarem no celular.

## 5. Estrutura do projeto

```
mapa-fotos-social/
├── index.html          → estrutura das telas e modais
├── css/style.css        → identidade visual do app
├── js/
│   ├── firebase-config.js  → suas chaves do Firebase
│   ├── i18n.js              → textos em PT / EN / ES
│   └── app.js                → toda a lógica (mapa, fotos, social, chat, eventos)
└── README.md
```

## 6. Como funciona por baixo dos panos

- **Localização e marcador**: `navigator.geolocation.watchPosition` mantém sua posição atualizada; sua foto de perfil é desenhada num marcador redondo dentro de um quadrado (`.user-marker` no CSS) sobre o mapa Leaflet.
- **Registrar foto**: o botão flutuante 📷 abre a câmera do celular (`<input capture="environment">`). Ao tirar a foto, o app pega sua posição atual, busca o clima na API gratuita [Open-Meteo](https://open-meteo.com) (sem necessidade de chave) e abre uma tela para você escrever título/descrição antes de publicar.
- **Banco de dados (Firestore)**: coleções `users`, `photos` (com subcoleção `comments`), `events` e `chats` (com subcoleção `messages`).
- **Armazenamento (Storage)**: fotos de perfil em `profile_photos/{uid}.jpg` e fotos do mapa em `photos/{uid}/{timestamp}.jpg`.
- **Pessoas no mapa**: o app lê a coleção `users` e desenha um marcador (borda laranja) para cada pessoa com localização salva; clicar abre o perfil dela.
- **Chat**: conversa 1-para-1 guardada em `chats/{idOrdenado}/messages`, atualizada em tempo real com `onSnapshot`.
- **Eventos**: a partir de uma foto, o botão "Divulgar como evento" cria um documento em `events` que aparece no mapa com um marcador pulsante 📣.

## 7. Próximos passos sugeridos (não incluídos nesta versão)

- Paginar/filtrar fotos e usuários por região visível do mapa (hoje carrega os mais recentes/todos — ótimo para começar, mas vale otimizar com geohash conforme a base crescer).
- Moderação de conteúdo (denunciar foto/usuário).
- Notificações push para novas mensagens/curtidas.
- Testes automatizados e paginação de comentários/chat.

---

Qualquer erro que aparecer no console do navegador quase sempre indica que falta preencher `js/firebase-config.js` ou publicar as regras de segurança acima.
