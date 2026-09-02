let usuarioAtual = null;
let nomeUsuarioAtual = "Alguém";

// ---------- INICIALIZAÇÃO ----------
(async () => {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    // Se não está logado, volta pra tela de login
    window.location.href = "index.html";
    return;
  }

  usuarioAtual = data.session.user;

  await carregarPerfil();
  await carregarFeed();
  await carregarSolicitacoes();
})();

// ---------- LOGOUT ----------
document.getElementById("btn-sair").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
});

// ---------- PERFIL ----------
async function carregarPerfil() {
  const { data: perfil, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", usuarioAtual.id)
    .single();

  if (error) {
    console.error("Erro ao carregar perfil:", error.message);
    return;
  }

  document.getElementById("nome-perfil").textContent = perfil.nome;
  nomeUsuarioAtual = perfil.nome;
  document.getElementById("descricao-perfil").value = perfil.descricao || "";

  if (perfil.foto_url) {
    document.getElementById("foto-perfil-atual").src = perfil.foto_url;
  }
}

document.getElementById("form-perfil").addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const mensagemPerfil = document.getElementById("mensagem-perfil");
  const descricao = document.getElementById("descricao-perfil").value;
  const arquivoFoto = document.getElementById("input-foto-perfil").files[0];

  let fotoUrl = null;

  // Se o usuário escolheu uma nova foto, faz o upload
  if (arquivoFoto) {
    const caminhoArquivo = `${usuarioAtual.id}/${Date.now()}_${arquivoFoto.name}`;

    const { error: erroUpload } = await supabaseClient.storage
      .from("avatars")
      .upload(caminhoArquivo, arquivoFoto);

    if (erroUpload) {
      alert("Erro ao enviar a foto: " + erroUpload.message);
      return;
    }

    const { data: urlPublica } = supabaseClient.storage
      .from("avatars")
      .getPublicUrl(caminhoArquivo);

    fotoUrl = urlPublica.publicUrl;
    document.getElementById("foto-perfil-atual").src = fotoUrl;
  }

 

  const dadosAtualizados = { descricao };
  if (fotoUrl) dadosAtualizados.foto_url = fotoUrl;

  const { error } = await supabaseClient
    .from("profiles")
    .update(dadosAtualizados)
    .eq("id", usuarioAtual.id);

  if (error) {
    alert("Erro ao salvar perfil: " + error.message);
    return;
  }

  mensagemPerfil.textContent = "Perfil atualizado com sucesso!";
  mensagemPerfil.hidden = false;
  setTimeout(() => (mensagemPerfil.hidden = true), 3000);
});

// ---------- POSTS ----------
document.getElementById("form-post").addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const descricao = document.getElementById("descricao-post").value;
  const arquivoFoto = document.getElementById("input-foto-post").files[0];

  const caminhoArquivo = `${usuarioAtual.id}/${Date.now()}_${arquivoFoto.name}`;

  const { error: erroUpload } = await supabaseClient.storage
    .from("posts")
    .upload(caminhoArquivo, arquivoFoto);

  if (erroUpload) {
    alert("Erro ao enviar a foto do post: " + erroUpload.message);
    return;
  }

  const { data: urlPublica } = supabaseClient.storage
    .from("posts")
    .getPublicUrl(caminhoArquivo);

  const { error: erroPost } = await supabaseClient.from("posts").insert({
    user_id: usuarioAtual.id,
    foto_url: urlPublica.publicUrl,
    descricao: descricao,
  });

  if (erroPost) {
    alert("Erro ao publicar: " + erroPost.message);
    return;
  }

  document.getElementById("form-post").reset();
  await carregarFeed();
});

async function carregarFeed() {
  const listaPosts = document.getElementById("lista-posts");

  const { data: amizades, error: erroAmizades } = await supabaseClient
    .from("friend_requests")
    .select("from_user, to_user")
    .eq("status", "aceito")
    .or(`from_user.eq.${usuarioAtual.id},to_user.eq.${usuarioAtual.id}`);

  if (erroAmizades) {
    listaPosts.innerHTML = `<p>Erro ao carregar publicações.</p>`;
    console.error("Erro ao carregar amizades:", erroAmizades.message);
    return;
  }

  const idsPermitidos = new Set([usuarioAtual.id]);
  amizades.forEach((amizade) => {
    idsPermitidos.add(
      amizade.from_user === usuarioAtual.id ? amizade.to_user : amizade.from_user
    );
  });

  // Busca os posts junto com o nome do autor (join com profiles)
  const { data: posts, error } = await supabaseClient
    .from("posts")
    //.select("id, foto_url, descricao, created_at, profiles ( nome )")
    .select("id, user_id, foto_url, descricao, created_at, profiles ( nome,foto_url )")
    .in("user_id", [...idsPermitidos])
    .order("created_at", { ascending: false });

  if (error) {
    listaPosts.innerHTML = `<p>Erro ao carregar publicações.</p>`;
    console.error(error.message);
    return;
  }

  if (!posts || posts.length === 0) {
    listaPosts.innerHTML = `<p>Nenhuma publicação ainda. Seja o primeiro a postar!</p>`;
    return;
  }

  const postIds = posts.map((post) => post.id);
  const { data: reacoes, error: erroReacoes } = await supabaseClient
    .from("post_reactions")
    .select("post_id, reaction_type")
    .eq("user_id", usuarioAtual.id)
    .in("post_id", postIds);

  if (erroReacoes) {
    console.error("Erro ao carregar reações:", erroReacoes.message);
  }

  const reacoesDoUsuario = new Map(
    (reacoes || []).map((reacao) => [reacao.post_id, reacao.reaction_type])
  );

//Montagem do post no HTML
  listaPosts.innerHTML = posts
    .map(
      (post) => `
      <div class="post">
        <div class="cabecalho-post">
          <div class="autor-post">
            <img class="foto-autor" src="${post.profiles?.foto_url ?? 'https://via.placeholder.com/40'}" alt="Foto do autor">
            <a class="link-autor" href="perfil.html?id=${encodeURIComponent(post.user_id)}">${post.profiles?.nome ?? "Usuário"}</a>
          </div>
          <time class="data-post" datetime="${post.created_at}">${formatarDataPost(post.created_at)}</time>
        </div>
        <p>${post.descricao}</p>
        <img src="${post.foto_url}" alt="Foto do post">
        <div class="reacoes-post" aria-label="Reações da publicação">
          ${criarBotoesReacao(post.id, reacoesDoUsuario.get(post.id))}
        </div>
        
      </div>
    `
    )
    .join("");
}

function criarBotoesReacao(idPost, reacaoAtual) {
  const reacoes = [
    ["joia", "👍", "Joia"],
    ["deslike", "👎", "Não gostei"],
    ["coracao", "❤️", "Coração"],
    ["impressionado", "😮", "Impressionado"],
  ];

  return reacoes.map(([tipo, icone, descricao]) => `
    <button class="botao-reacao${reacaoAtual === tipo ? " selecionado" : ""}"
      type="button" title="${descricao}" aria-label="${descricao}"
      onclick="reagirAoPost('${idPost}', '${tipo}', this)">${icone}</button>
  `).join("");
}

async function reagirAoPost(idPost, tipoReacao, botao) {
  const { data: reacaoExistente, error: erroBusca } = await supabaseClient
    .from("post_reactions")
    .select("id, reaction_type")
    .eq("post_id", idPost)
    .eq("user_id", usuarioAtual.id)
    .maybeSingle();

  if (erroBusca) {
    alert("Erro ao verificar sua reação: " + erroBusca.message);
    return;
  }

  let tipoNotificacao = tipoReacao;

  if (reacaoExistente?.reaction_type === tipoReacao) {
    const { error } = await supabaseClient
      .from("post_reactions")
      .delete()
      .eq("id", reacaoExistente.id);

    if (error) {
      alert("Erro ao remover reação: " + error.message);
      return;
    }
    tipoNotificacao = null;
  } else {
    const { error } = await supabaseClient
      .from("post_reactions")
      .upsert(
        { post_id: idPost, user_id: usuarioAtual.id, reaction_type: tipoReacao },
        { onConflict: "post_id,user_id" }
      );

    if (error) {
      alert("Erro ao reagir ao post: " + error.message);
      return;
    }
  }

  const botoes = botao.closest(".reacoes-post").querySelectorAll(".botao-reacao");
  botoes.forEach((item) => item.classList.remove("selecionado"));
  if (tipoNotificacao) botao.classList.add("selecionado");

  if (tipoNotificacao) await criarNotificacao(idPost, tipoNotificacao);
}

async function criarNotificacao(idPost, tipoReacao) {
  const { data: post, error: erroPost } = await supabaseClient
    .from("posts")
    .select("user_id")
    .eq("id", idPost)
    .single();

  if (erroPost || post.user_id === usuarioAtual.id) return;

  const mensagens = {
    joia: "deu uma joia no seu post",
    deslike: "não gostou do seu post",
    coracao: "deu um coração no seu post",
    impressionado: "ficou impressionado com o seu post",
  };

  const { error } = await supabaseClient.from("notifications").insert({
    recipient_id: post.user_id,
    from_user: usuarioAtual.id,
    post_id: idPost,
    message: `${nomeUsuarioAtual} ${mensagens[tipoReacao]}`,
  });

  if (error) console.error("Erro ao criar notificação:", error.message);
}

function formatarDataPost(dataPost) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dataPost));
}

// ---------- BUSCA DE AMIGOS ----------
document.getElementById("btn-buscar").addEventListener("click", buscarUsuarios);
document.getElementById("input-busca").addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") buscarUsuarios();
});

async function buscarUsuarios() {
  const termo = document.getElementById("input-busca").value.trim();
  const resultadoBusca = document.getElementById("resultado-busca");

  if (!termo) return;

  const { data: usuarios, error } = await supabaseClient
    .from("profiles")
    .select("id, nome")
    .ilike("nome", `%${termo}%`)
    .neq("id", usuarioAtual.id)
    .limit(10);

  if (error) {
    resultadoBusca.innerHTML = `<p>Erro ao buscar.</p>`;
    return;
  }

  if (usuarios.length === 0) {
    resultadoBusca.innerHTML = `<p>Nenhum usuário encontrado.</p>`;
    return;
  }

  resultadoBusca.innerHTML = usuarios
    .map(
      (usuario) => `
      <div class="item-usuario">
        <span>${usuario.nome}</span>
        <button onclick="enviarSolicitacao('${usuario.id}', this)">Adicionar</button>
      </div>
    `
    )
    .join("");
}

async function enviarSolicitacao(idDestinatario, botao) {
  const { error } = await supabaseClient.from("friend_requests").insert({
    from_user: usuarioAtual.id,
    to_user: idDestinatario,
    status: "pendente",
  });

  if (error) {
    alert("Erro ao enviar solicitação: " + error.message);
    return;
  }

  botao.textContent = "Solicitação enviada";
  botao.disabled = true;
}

// ---------- NOTIFICAÇÕES / SOLICITAÇÕES DE AMIZADE ----------
const btnNotificacoes = document.getElementById("btn-notificacoes");
const painelNotificacoes = document.getElementById("painel-notificacoes");
const listaNotificacoes = document.getElementById("lista-notificacoes");
const contadorNotificacoes = document.getElementById("contador-notificacoes");

// Abre/fecha o painel ao clicar no sino
btnNotificacoes.addEventListener("click", (evento) => {
  evento.stopPropagation();
  painelNotificacoes.hidden = !painelNotificacoes.hidden;
});

// Fecha o painel se clicar em qualquer outro lugar da página
document.addEventListener("click", (evento) => {
  if (!painelNotificacoes.hidden && !painelNotificacoes.contains(evento.target)) {
    painelNotificacoes.hidden = true;
  }
});

async function carregarSolicitacoes() {
  // Busca as solicitações pendentes recebidas, já trazendo o nome de quem enviou
  const { data: solicitacoes, error } = await supabaseClient
    .from("friend_requests")
    .select("id, status, profiles!friend_requests_from_user_fkey ( nome )")
    .eq("to_user", usuarioAtual.id)
    .eq("status", "pendente")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar solicitações:", error.message);
    return;
  }

  const { data: notificacoes, error: erroNotificacoes } = await supabaseClient
    .from("notifications")
    .select("id, message, created_at")
    .eq("recipient_id", usuarioAtual.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (erroNotificacoes) {
    console.error("Erro ao carregar notificações:", erroNotificacoes.message);
  }

  // Atualiza o contador no sino
  const totalNotificacoes = solicitacoes.length + (notificacoes || []).length;
  if (totalNotificacoes > 0) {
    contadorNotificacoes.textContent = totalNotificacoes;
    contadorNotificacoes.hidden = false;
  } else {
    contadorNotificacoes.hidden = true;
  }

  // Atualiza a lista dentro do painel
  if (solicitacoes.length === 0 && (!notificacoes || notificacoes.length === 0)) {
    listaNotificacoes.innerHTML = `<p class="texto-vazio">Nenhuma solicitação pendente.</p>`;
    return;
  }

  listaNotificacoes.innerHTML = [
    ...solicitacoes.map(
      (solicitacao) => `
      <div class="item-notificacao">
        <div class="nome-solicitante"><strong>${solicitacao.profiles?.nome ?? "Alguém"}</strong> quer te adicionar</div>
        <div class="botoes-notificacao">
          <button class="btn-aceitar" onclick="responderSolicitacao('${solicitacao.id}', 'aceito')">Aceitar</button>
          <button class="btn-recusar" onclick="responderSolicitacao('${solicitacao.id}', 'recusado')">Recusar</button>
        </div>
      </div>
    `
    ),
    ...(notificacoes || []).map(
      (notificacao) => `
      <div class="item-notificacao">
        <div class="nome-solicitante">${notificacao.message}</div>
        <time class="data-notificacao" datetime="${notificacao.created_at}">${formatarDataPost(notificacao.created_at)}</time>
      </div>
    `
    ),
  ]
    .join("");
}

async function responderSolicitacao(idSolicitacao, novoStatus) {
  const { error } = await supabaseClient
    .from("friend_requests")
    .update({ status: novoStatus })
    .eq("id", idSolicitacao);

  if (error) {
    alert("Erro ao responder solicitação: " + error.message);
    return;
  }

  await carregarSolicitacoes();
}
