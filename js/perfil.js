const parametros = new URLSearchParams(window.location.search);
const idPerfil = parametros.get("id");
const listaPosts = document.getElementById("lista-posts-perfil");

(async () => {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "index.html";
    return;
  }

  if (!idPerfil) {
    mostrarErro("Perfil nao encontrado.");
    return;
  }

  await carregarPerfilPublico();
  await carregarPostsDoPerfil();
})();

async function carregarPerfilPublico() {
  const { data: perfil, error } = await supabaseClient
    .from("profiles")
    .select("nome, descricao, foto_url")
    .eq("id", idPerfil)
    .single();

  if (error) {
    mostrarErro("Nao foi possivel carregar este perfil.");
    return;
  }

  document.getElementById("nome-perfil-publico").textContent = perfil.nome;
  document.getElementById("descricao-perfil-publico").textContent = perfil.descricao || "";

  if (perfil.foto_url) {
    document.getElementById("foto-perfil-publico").src = perfil.foto_url;
  }
}

async function carregarPostsDoPerfil() {
  const { data: posts, error } = await supabaseClient
    .from("posts")
    .select("id, foto_url, descricao, created_at")
    .eq("user_id", idPerfil)
    .order("created_at", { ascending: false });

  if (error) {
    mostrarErro("Nao foi possivel carregar as publicacoes.");
    return;
  }

  if (!posts || posts.length === 0) {
    listaPosts.innerHTML = "<p>Nenhuma publicacao ainda.</p>";
    return;
  }

  listaPosts.innerHTML = posts.map((post) => `
    <article class="post">
      <div class="cabecalho-post">
        <span>Publicacao</span>
        <time class="data-post" datetime="${post.created_at}">${formatarDataPost(post.created_at)}</time>
      </div>
      <p>${escaparHtml(post.descricao || "")}</p>
      <img src="${post.foto_url}" alt="Foto da publicacao">
    </article>
  `).join("");
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

function escaparHtml(texto) {
  return texto.replace(/[&<>'"]/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[caractere]);
}

function mostrarErro(mensagem) {
  listaPosts.innerHTML = `<p>${mensagem}</p>`;
}
