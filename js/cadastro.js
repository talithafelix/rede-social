const formCadastro = document.getElementById("form-cadastro");
const mensagemErro = document.getElementById("mensagem-erro");
const mensagemSucesso = document.getElementById("mensagem-sucesso");

formCadastro.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensagemErro.hidden = true;
  mensagemSucesso.hidden = true;

  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const nascimento = document.getElementById("nascimento").value;
  const senha = document.getElementById("senha").value;

  // Cria o usuário no sistema de autenticação do Supabase.
  // Nome e data de nascimento vão como "metadata" (options.data) e são usados
  // por um gatilho no banco (veja CONFIGURACAO_BANCO.md) para criar o perfil
  // automaticamente — assim não dependemos de uma sessão já ativa aqui.
  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: senha,
    options: {
      data: {
        nome: nome,
        data_nascimento: nascimento,
      },
    },
  });

  if (error) {
    mensagemErro.textContent = "Erro ao cadastrar: " + error.message;
    mensagemErro.hidden = false;
    return;
  }

  formCadastro.reset();

  // Se a confirmação de e-mail estiver ativada no Supabase, "session" vem nula
  // aqui — ou seja, a conta foi criada mas ainda não pode ser usada até a
  // pessoa clicar no link enviado por e-mail.
  if (!data.session) {
    mensagemSucesso.textContent =
      `Quase lá! Enviamos um e-mail de confirmação para ${email}. ` +
      "Verifique sua caixa de entrada (e a pasta de spam) e clique no link antes de fazer login.";
    mensagemSucesso.hidden = false;
    return;
  }

  // Se a confirmação de e-mail estiver desativada, o usuário já entra logado.
  mensagemSucesso.textContent = "Cadastro realizado! Redirecionando...";
  mensagemSucesso.hidden = false;

  setTimeout(() => {
    window.location.href = "index.html";
  }, 2000);
});
