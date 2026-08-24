const formLogin = document.getElementById("form-login");
const mensagemErro = document.getElementById("mensagem-erro");

// Se o usuário já estiver logado, manda direto pra home
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    window.location.href = "home.html";
  }
})();

formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensagemErro.hidden = true;

  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: senha,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      mensagemErro.textContent =
        "Você ainda não confirmou seu e-mail. Verifique sua caixa de entrada (e o spam) e clique no link que enviamos antes de fazer login.";
    } else {
      mensagemErro.textContent = "E-mail ou senha inválidos.";
    }
    mensagemErro.hidden = false;
    return;
  }

  window.location.href = "home.html";
});
