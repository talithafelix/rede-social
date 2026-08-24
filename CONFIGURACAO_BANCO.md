# Configuração do banco de dados (Supabase)

Este projeto usa o **Supabase** como banco de dados. Siga os passos abaixo com calma.

## 1. Criar a conta e o projeto

1. Acesse https://supabase.com e crie uma conta gratuita (pode usar login com GitHub ou Google).
2. Clique em **New Project**.
3. Dê um nome ao projeto, crie uma senha para o banco (guarde essa senha) e escolha a região mais próxima (ex: South America).
4. Aguarde alguns minutos até o projeto ser criado.

## 2. Pegar a URL e a chave da API

1. Dentro do projeto, vá em **Project Settings** (ícone de engrenagem) > **API**.
2. Copie o valor de **Project URL**.
3. Copie o valor de **anon public** (dentro de "Project API keys").
4. Abra o arquivo `js/supabaseClient.js` e cole os dois valores nas variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

## 3. Criar as tabelas do banco

Vá em **SQL Editor** (menu lateral) > **New query**, cole o código abaixo e clique em **Run**.

```sql
-- Tabela de perfis (dados extras de cada usuário, além do login)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  nome text not null,
  email text,
  data_nascimento date,
  foto_url text,
  descricao text,
  criado_em timestamp with time zone default now()
);

-- Tabela de publicações
create table posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  foto_url text not null,
  descricao text,
  created_at timestamp with time zone default now()
);

-- Tabela de solicitações de amizade
create table friend_requests (
  id uuid default gen_random_uuid() primary key,
  from_user uuid references profiles(id) on delete cascade,
  to_user uuid references profiles(id) on delete cascade,
  status text default 'pendente', -- pendente | aceito | recusado
  created_at timestamp with time zone default now()
);
```

## 4. Ativar a segurança (RLS) e criar as regras de acesso

O Supabase bloqueia o acesso às tabelas por padrão até você criar regras (isso é bom, evita que qualquer pessoa
leia ou apague os dados de todo mundo). Rode este segundo bloco no SQL Editor:

```sql
-- Ativa a segurança em todas as tabelas
alter table profiles enable row level security;
alter table posts enable row level security;
alter table friend_requests enable row level security;

-- PROFILES: qualquer pessoa logada pode ver todos os perfis (pra busca funcionar)
create policy "Perfis são visíveis para todos os logados"
  on profiles for select
  using (auth.role() = 'authenticated');

-- PROFILES: cada usuário só pode editar o próprio perfil
create policy "Usuário edita apenas o próprio perfil"
  on profiles for update
  using (auth.uid() = id);

-- PROFILES: o próprio usuário pode inserir seu perfil no cadastro
create policy "Usuário cria o próprio perfil"
  on profiles for insert
  with check (auth.uid() = id);

-- POSTS: todo mundo logado pode ver os posts (feed)
create policy "Posts visíveis para todos os logados"
  on posts for select
  using (auth.role() = 'authenticated');

-- POSTS: usuário só pode criar post em nome dele mesmo
create policy "Usuário cria seus próprios posts"
  on posts for insert
  with check (auth.uid() = user_id);

-- FRIEND_REQUESTS: usuário vê solicitações que enviou ou recebeu
create policy "Ver próprias solicitações"
  on friend_requests for select
  using (auth.uid() = from_user or auth.uid() = to_user);

-- FRIEND_REQUESTS: usuário só pode criar solicitação partindo dele mesmo
create policy "Criar solicitação"
  on friend_requests for insert
  with check (auth.uid() = from_user);

-- FRIEND_REQUESTS: quem recebeu a solicitação pode aceitar ou recusar (mudar o status)
create policy "Destinatário responde à solicitação"
  on friend_requests for update
  using (auth.uid() = to_user)
  with check (auth.uid() = to_user);
```

## 5. Criar o perfil automaticamente no cadastro (gatilho)

Por padrão, o Supabase exige que o usuário confirme o e-mail antes de ter uma sessão ativa. Isso significa
que, logo depois do `signUp()`, o navegador ainda não está "autenticado" de verdade — e por isso tentar
inserir na tabela `profiles` direto pelo JavaScript é barrado pela política de segurança (erro
`new row violates row-level security policy`).

A solução correta é criar um **gatilho (trigger)** no banco: toda vez que um novo usuário é criado em
`auth.users`, o próprio banco cria a linha correspondente em `profiles`, sem depender da sessão do navegador.

Rode este SQL no **SQL Editor**:

```sql
-- Função que cria o perfil automaticamente
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, data_nascimento)
  values (
    new.id,
    new.raw_user_meta_data ->> 'nome',
    new.email,
    (new.raw_user_meta_data ->> 'data_nascimento')::date
  );
  return new;
end;
$$;

-- Gatilho que executa a função sempre que um usuário novo é criado
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

> `security definer` faz essa função rodar com permissões elevadas, então ela não é bloqueada pelo RLS.
> Com isso, o `js/cadastro.js` não precisa mais inserir manualmente em `profiles` — ele só envia `nome` e
> `data_nascimento` como metadata no `signUp()`, e o banco cuida do resto.

### Sobre a confirmação de e-mail

Por padrão, o Supabase exige que o usuário confirme o e-mail antes de conseguir fazer login (isso é bom para
produção, evita cadastros com e-mails falsos). O site já está preparado pra isso: depois do cadastro, a pessoa
vê uma mensagem avisando para checar o e-mail, e se tentar fazer login antes de confirmar, também aparece um
aviso amigável em vez de um erro genérico.

Se quiser desativar essa exigência apenas para facilitar os testes (não recomendado em produção), vá em
**Authentication > Providers > Email** e desative **Confirm email**.

## 6. Criar os buckets de armazenamento (para as fotos)

1. No menu lateral, vá em **Storage**.
2. Clique em **New bucket**, crie um bucket chamado `avatars` e marque a opção **Public bucket**.
3. Repita e crie outro bucket chamado `posts`, também **Public bucket**.

Esses dois buckets são usados para guardar, respectivamente, as fotos de perfil e as fotos das publicações.

## 7. Criar as políticas de acesso do Storage (upload de fotos)

Assim como as tabelas, os arquivos dentro dos buckets (`avatars` e `posts`) também são protegidos por RLS.
Marcar o bucket como "Public" só permite que qualquer pessoa **veja** os arquivos — o **envio** (upload)
continua bloqueado até criarmos uma política liberando isso.

Rode este SQL no **SQL Editor** (isso só funciona depois de criar os dois buckets acima):

```sql
-- AVATARS: qualquer pessoa logada pode enviar uma foto, desde que dentro da
-- própria pasta (o código já envia para uma pasta com o próprio id do usuário)
create policy "Usuário envia sua própria foto de perfil"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- AVATARS: qualquer pessoa logada pode atualizar/substituir a própria foto
create policy "Usuário atualiza sua própria foto de perfil"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- AVATARS: todo mundo pode visualizar as fotos de perfil (bucket público)
create policy "Fotos de perfil são visíveis para todos"
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- POSTS: qualquer pessoa logada pode enviar foto de post na própria pasta
create policy "Usuário envia foto do próprio post"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'posts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- POSTS: todo mundo pode visualizar as fotos dos posts (bucket público)
create policy "Fotos de posts são visíveis para todos"
on storage.objects for select
to public
using (bucket_id = 'posts');
```

> Repare que a condição `(storage.foldername(name))[1] = auth.uid()::text` só permite que cada pessoa envie
> arquivos dentro de uma pasta com o próprio ID — é por isso que o código (`home.js`) sempre monta o caminho
> do arquivo como `${usuarioAtual.id}/nome-do-arquivo`.

## 8. Testar

Abra o arquivo `index.html` no navegador (ou use a extensão **Live Server** do VS Code), crie uma conta na tela
de cadastro e faça login. Se tudo estiver certo, você já vai conseguir editar o perfil, postar e buscar outros
usuários cadastrados.

---

### Por que o Supabase?

- **Gratuito** para projetos pequenos/médios (500MB de banco + 1GB de armazenamento de arquivos no plano free).
- Já vem com **autenticação pronta** (login/cadastro por e-mail e senha), então você não precisa programar isso
  do zero nem se preocupar em guardar senhas com segurança.
- O banco é **PostgreSQL de verdade** (SQL), o que é ótimo pra aprender, já que é usado no mercado.
- Tem um **painel visual** (parecido com uma planilha) pra você ver e editar os dados sem precisar escrever código.
- Guarda arquivos (fotos) através do **Storage**, dispensando outro serviço separado.
