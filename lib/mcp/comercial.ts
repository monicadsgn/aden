// Ferramentas do conector: comercial. Movidas de servidor.ts sem mudar nenhuma.

import type { RepositorioSupabase } from "../dados/supabase";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { faltaDefinir, mudarStatusCampanha, novaCampanha, paginaUrlValida } from "../calculo/campanhas";
import type { Campanha } from "../calculo/campanhas";
import { ROTULO_QUALIFICACAO, diasNaEtapa, etapaAberta, moverLead, novoLead, resumoFunil, rotuloEtapa, situacaoFollowUp } from "../calculo/crm";
import type { Lead } from "../calculo/crm";
import { calcularVisaoMes } from "../calculo/mes";
import { calcularTrilha, espacoPraVender, unidadeDoCriterio } from "../calculo/metas";
import { novoId } from "../calculo/novo";
import { frasesParaCliente, pacotePadrao, pacoteParaCenario, parcelasDoProjeto, prazoDoProjeto, precoDoPacote, projetosQueCabem, textoParcelas } from "../calculo/pacotes";
import { configQuizVazia, linkDoQuiz, normalizarConfigQuiz } from "../calculo/quizConfig";
import { resumoDoQuiz, resumoPorCampanha } from "../calculo/quizFunil";
import type { Meta, Pacote } from "../calculo/tipos";
import { ganharLead } from "../dados/acoes";
import { metricasDoCliente } from "../meta/metricasCliente";
import { publicarMeta } from "../meta/publicar";
import { conferirConexaoMeta } from "../meta/conferir";
import { ROTULO_STATUS_META } from "../meta/estado";
import { paraCentavos, paraReais, resolver } from "./traducao";
import { z } from "zod";
import { aplicar, executar, opt, salvarDiferenca } from "./comum";

export function registrarComercial(server: McpServer, obterRepo: () => Promise<RepositorioSupabase>, origem: string) {
  // ─── CRM ──────────────────────────────────────────────────────────────────

  server.registerTool(
    "listar_leads",
    {
      title: "Listar leads",
      description: "Leads do funil com etapa, dias na etapa, valor estimado, próximo contato e responsável. Por padrão só os em aberto. Inclui o resumo do funil. Lead que veio do quiz traz a etiqueta (qualificacao: qualificado, com ressalva, desqualificado ou só social media), o que pesou nela, empresa, cidade e as respostas.",
      inputSchema: { incluirFechados: z.boolean().optional() },
    },
    async ({ incluirFechados }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const leads = await repo.listarLeads();
        const nome = (id: string | null) => (id ? (config.pessoas.find((p) => p.id === id)?.nome ?? null) : null);
        const r = resumoFunil(leads);
        return {
          resumo: { ...r, valorEmAberto: paraReais(r.valorEmAbertoCentavos), valorGanhoNoMes: paraReais(r.valorGanhoNoMesCentavos) },
          leads: leads
            .filter((l) => incluirFechados || etapaAberta(l.etapa))
            .map((l) => ({
              id: l.id,
              nome: l.nome,
              etapa: rotuloEtapa(l.etapa),
              diasNaEtapa: diasNaEtapa(l),
              valorEstimadoMensal: paraReais(l.valorEstimadoCentavos),
              pacote: (config.pacotes ?? []).find((p) => p.id === l.pacoteId)?.nome ?? null,
              responsavel: nome(l.responsavelId),
              proximoContato: l.proximoContato,
              proximaAcao: l.proximaAcao,
              contato: [l.contato, l.telefone, l.instagram, l.email].filter(Boolean).join(" · "),
              origem: l.origem,
              campanha: l.campanha ?? null,
              observacoes: l.observacoes,
              motivoPerda: l.motivoPerda || null,
              ...(l.qualificacao
                ? {
                    qualificacao: ROTULO_QUALIFICACAO[l.qualificacao],
                    motivosDaEtiqueta: l.qualificacaoMotivos || null,
                    empresa: l.empresa || null,
                    cidade: l.cidade || null,
                    respostasDoQuiz: l.respostasQuiz ?? [],
                  }
                : {}),
            })),
        };
      }),
  );

  server.registerTool(
    "ver_funil_quiz",
    {
      title: "Funil do quiz de conversão",
      description:
        "Quantas pessoas começaram o quiz, quantas enviaram o contato, quantas chegaram em cada tela e onde mais gente parou sem enviar. Mostra também quantos leads saíram com cada etiqueta e o resultado de cada campanha de anúncio (quem veio por link com campanha). Só leitura. Telas de verba mínima e de verba para anúncios só aparecem para parte das pessoas (depende do faturamento), então chegam menos gente nelas de propósito.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const repo = await obterRepo();
        const visitas = await repo.quizProgresso();
        const r = resumoDoQuiz(visitas);
        return {
          comecaram: r.comecaram,
          enviaram: r.enviaram,
          taxaDeEnvioPct: r.taxaDeEnvio,
          ondeMaisParam: r.ondeMaisParam ? { tela: r.ondeMaisParam.rotulo, pessoas: r.ondeMaisParam.pararamAqui } : null,
          telas: r.telas.map((t) => ({ tela: t.rotulo, chegaram: t.viram, pctDeQuemComecou: t.pctDeQuemComecou, pararamAqui: t.pararamAqui, observacao: t.sePula ?? null })),
          porCampanha: resumoPorCampanha(visitas).map((c) => ({ campanha: c.rotulo, comecaram: c.comecaram, enviaram: c.enviaram, taxaDeEnvioPct: c.taxaDeEnvio, bons: c.bons })),
          etiquetas: {
            qualificado: r.porEtiqueta.qualificado,
            comRessalva: r.porEtiqueta.com_ressalva,
            desqualificado: r.porEtiqueta.desqualificado,
            soSocialMedia: r.porEtiqueta.social_media,
          },
        };
      }),
  );

  server.registerTool(
    "ver_config_quiz",
    {
      title: "Configuração do quiz",
      description:
        "WhatsApp do botão, Instagram e códigos de pixel (Meta e Google) que a página pública do quiz usa. Campo vazio = a página usa o valor de reserva dela. Só leitura.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const repo = await obterRepo();
        const c = await repo.carregarConfigQuiz().catch(() => configQuizVazia());
        return {
          whatsapp: c.whatsapp || null,
          instagram: c.instagramUrl || null,
          pixelMeta: c.metaPixel || null,
          tagGoogle: c.googleTag || null,
          pixelMetaLigado: Boolean(c.metaPixel),
          googleLigado: Boolean(c.googleTag),
          paginaDoQuiz: `${origem}/quiz`,
        };
      }),
  );

  server.registerTool(
    "ver_conexao_meta",
    {
      title: "Conexão com o Instagram e o Facebook",
      description:
        "Confere com a Meta (só leitura) o acesso da Aden: quais Páginas e Instagrams ele enxerga e que permissões tem. Com cliente, diz o estado da conexão dele (não conectado, conectando, conectado, com problema, pausado), o motivo e o passo a passo pronto para o cliente liberar o acesso. Não publica nada, não liga publicação nem métricas e nunca mostra token. Se a conexão estiver desligada, diga que um sócio cadastra META_CONEXAO_ATIVA=1 na Vercel e faz Redeploy.",
      inputSchema: { cliente: z.string().optional().describe("nome ou id; sem isso, só lista o que o acesso enxerga") },
    },
    async ({ cliente }) =>
      executar(async () => {
        const repo = await obterRepo();
        const c = cliente ? resolver((await repo.carregarConfig()).clientes, cliente, "Cliente") : null;
        const r = await conferirConexaoMeta(repo, c?.id);
        if (!r.ativo) return r.motivo === "desligado" ? "A conexão com a Meta está desligada (META_CONEXAO_ATIVA na Vercel)." : "Falta o acesso da Aden à Meta na Vercel (META_ACCESS_TOKEN).";
        return {
          acesso: { valendo: r.token.valido, venceEm: r.token.expiraEm, erro: r.token.erro, faltaPorEtapa: r.token.porEtapa.filter((e) => e.faltam.length).map((e) => ({ etapa: e.rotulo, faltam: e.faltam })) },
          paginas: r.contas.map((x) => ({ pagina: x.paginaNome, instagram: x.instagramUsuario ? `@${x.instagramUsuario}` : null })),
          erroAoListar: r.erroContas,
          ...(r.cliente && c && {
            cliente: { nome: c.nome, status: ROTULO_STATUS_META[r.cliente.status], motivo: r.cliente.motivo, pagina: r.cliente.paginaNome, instagram: r.cliente.instagramUsuario ? `@${r.cliente.instagramUsuario}` : null, passoAPassoParaOCliente: r.cliente.passosParaCliente },
          }),
        };
      }),
  );

  server.registerTool(
    "ver_metricas_instagram",
    {
      title: "Métricas do Instagram do cliente (só leitura)",
      description:
        "Puxa direto da Meta os números do Instagram de um cliente conectado: visualizações, pessoas alcançadas, interações, compartilhamentos, salvamentos, visitas ao perfil, cliques no link e seguidores novos, cada um com o período anterior e a variação em %. Traz também o alcance e os seguidores dia a dia, os melhores posts do período e o perfil do público. Use para montar o relatório e a apresentação (siga a skill de relatório da Aden). Só funciona se o cliente estiver conectado e com \"Permitir ler métricas\" ligado na ficha. Nunca invente número: o que vier em `faltou` a Meta não devolveu, avise em vez de estimar. Os últimos 1 ou 2 dias podem estar incompletos na Meta.",
      inputSchema: {
        cliente: z.string().describe("nome ou id do cliente"),
        dias: z.number().int().min(1).max(30).optional().describe("tamanho do período em dias (padrão 28, máximo 30); compara com o período de mesmo tamanho logo antes"),
      },
    },
    async ({ cliente, dias }) =>
      executar(async () => {
        const repo = await obterRepo();
        const c = resolver((await repo.carregarConfig()).clientes, cliente, "Cliente");
        const r = await metricasDoCliente(repo, c.id, dias);
        if (!r.ativo) return r.motivo === "desligado" ? "A conexão com a Meta está desligada (META_CONEXAO_ATIVA)." : "Falta o acesso da Aden à Meta na Vercel.";
        return r;
      }),
  );

  server.registerTool(
    "publicar_no_instagram",
    {
      title: "Publicar foto ou carrossel no Instagram (etapa de teste)",
      description:
        "Publica uma foto (1 imagem) ou um carrossel (2 a 10) no Instagram de um cliente conectado, só se a publicação estiver ligada na Vercel (META_PUBLICAR_ATIVO=1), o @ estiver em META_PUBLICAR_CONTAS e \"Publicar no Instagram\" estiver ligado na ficha. Imagens: links https terminando em .jpg. SEMPRE comece com dryRun=true (padrão): mostra a prévia e a frase de confirmação. Só use dryRun=false depois que a Moni ou o Áleff escreverem, na conversa, que podem publicar, e passe a frase exata em confirmacao. Nunca publique por conta própria nem em conta de cliente sem o pedido deles.",
      inputSchema: {
        cliente: z.string().describe("nome ou id do cliente"),
        imagens: z.array(z.string()).describe("links https das imagens (.jpg), em ordem"),
        legenda: z.string().optional(),
        dryRun: z.boolean().optional().describe("padrão true (só prévia)"),
        confirmacao: z.string().optional().describe("frase exata da prévia, só com dryRun=false"),
      },
    },
    async ({ cliente, imagens, legenda, dryRun, confirmacao }) =>
      executar(async () => {
        const repo = await obterRepo();
        const c = resolver((await repo.carregarConfig()).clientes, cliente, "Cliente");
        const r = await publicarMeta(repo, { clienteId: c.id, imagens, legenda, dryRun: dryRun === false ? false : true, confirmacao });
        if (!r.ativo) return r.motivo === "desligado" ? "A conexão com a Meta está desligada (META_CONEXAO_ATIVA)." : r.motivo === "publicacao_desligada" ? "A publicação está desligada na Vercel (META_PUBLICAR_ATIVO)." : "Falta o acesso da Aden à Meta na Vercel.";
        return r;
      }),
  );

  server.registerTool(
    "listar_campanhas",
    {
      title: "Listar campanhas",
      description: "Lista as campanhas (páginas e ofertas que trazem leads): status, o que promete, quem entra, regras, serviços, limite de clientes, link e o que ainda falta definir. O quiz de conversão é a primeira. Só leitura.",
      inputSchema: { status: z.enum(["ativa", "pausada", "arquivada"]).optional().describe("filtra por status; sem isso, todas") },
    },
    async ({ status }) =>
      executar(async () => {
        const lista = await (await obterRepo()).listarCampanhas();
        return lista
          .filter((c) => !status || c.status === status)
          .map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo, status: c.status, promete: c.promete || null, quemEntra: c.quemEntra || null, regras: c.regras || null, servicos: c.servicos || null, limiteClientes: c.limiteClientes, paginaUrl: c.paginaUrl || null, notas: c.notas || null, faltaDefinir: faltaDefinir(c) }));
      }),
  );

  server.registerTool(
    "salvar_campanha",
    {
      title: "Criar ou alterar campanha",
      description:
        "Cria uma campanha (sem id) ou altera uma existente (com id). Campo não enviado fica como está; texto vazio limpa. Só grave o que os sócios disseram na conversa, nunca invente regra, limite ou prazo. Para pausar, reativar ou arquivar use status. Nada se apaga. Pausar é só registro: não tira a página do ar.",
      inputSchema: {
        id: z.string().optional().describe("id da campanha (de listar_campanhas); sem id cria uma nova"),
        nome: z.string().optional(),
        status: z.enum(["ativa", "pausada", "arquivada"]).optional(),
        promete: z.string().max(4000).optional().describe("o que o anúncio e a página prometem"),
        quemEntra: z.string().max(4000).optional().describe("quem pode entrar e quem não"),
        regras: z.string().max(4000).optional(),
        servicos: z.string().max(2000).optional(),
        limiteClientes: z.number().int().min(0).nullable().optional().describe("null = sem limite combinado"),
        paginaUrl: z.string().max(300).optional().describe("https://..."),
        notas: z.string().max(8000).optional(),
      },
    },
    async (a) =>
      executar(async () => {
        const repo = await obterRepo();
        const lista = await repo.listarCampanhas();
        let c: Campanha;
        if (a.id) {
          const antes = lista.find((x) => x.id === a.id);
          if (!antes) throw new Error("Não achei essa campanha. Use listar_campanhas para ver os ids.");
          c = antes;
        } else {
          if (!a.nome?.trim()) throw new Error("Para criar uma campanha, diga o nome.");
          c = novaCampanha(novoId(), a.nome);
        }
        if (a.paginaUrl !== undefined && !paginaUrlValida(a.paginaUrl)) throw new Error("O link da página precisa começar com https://.");
        c = {
          ...c,
          nome: a.nome?.trim() || c.nome,
          promete: a.promete ?? c.promete,
          quemEntra: a.quemEntra ?? c.quemEntra,
          regras: a.regras ?? c.regras,
          servicos: a.servicos ?? c.servicos,
          limiteClientes: a.limiteClientes === undefined ? c.limiteClientes : a.limiteClientes,
          paginaUrl: a.paginaUrl === undefined ? c.paginaUrl : a.paginaUrl.trim(),
          notas: a.notas ?? c.notas,
        };
        if (a.status) c = mudarStatusCampanha(c, a.status);
        await repo.salvarCampanha(c);
        return { salvo: true, id: c.id, nome: c.nome, status: c.status, faltaDefinir: faltaDefinir(c) };
      }),
  );

  server.registerTool(
    "salvar_config_quiz",
    {
      title: "Alterar configuração do quiz",
      description:
        "Troca o WhatsApp do botão, o Instagram e os códigos de pixel (Meta e Google) do quiz. Só mande o que a pessoa disse na conversa, nunca invente. Campo não enviado fica como está; texto vazio apaga o campo (a página volta ao valor de reserva). Aceita número com máscara, @usuario ou o código colado: a ferramenta arruma e diz o que não entendeu. Vale na página em até 1 minuto.",
      inputSchema: {
        whatsapp: z.string().optional().describe("com DDD, ex.: (81) 99999-9999"),
        instagram: z.string().optional().describe("@usuario ou endereço"),
        pixelMeta: z.string().optional().describe("ID do pixel da Meta (só números)"),
        tagGoogle: z.string().optional().describe("G-..., AW-... ou GTM-..."),
      },
    },
    async ({ whatsapp, instagram, pixelMeta, tagGoogle }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfigQuiz().catch(() => configQuizVazia());
        const r = normalizarConfigQuiz({
          whatsapp: whatsapp ?? antes.whatsapp,
          instagramUrl: instagram ?? antes.instagramUrl,
          metaPixel: pixelMeta ?? antes.metaPixel,
          googleTag: tagGoogle ?? antes.googleTag,
        });
        const problemas = Object.values(r.erros);
        if (problemas.length) throw new Error(`Nada foi salvo. ${problemas.join(" ")}`);
        await repo.salvarConfigQuiz(r.config);
        return {
          salvo: true,
          whatsapp: r.config.whatsapp || null,
          instagram: r.config.instagramUrl || null,
          pixelMeta: r.config.metaPixel || null,
          tagGoogle: r.config.googleTag || null,
        };
      }),
  );

  server.registerTool(
    "gerar_link_quiz",
    {
      title: "Link do quiz para anúncio",
      description:
        "Monta o endereço do quiz com a campanha grudada (utm). Use esse link no anúncio: o lead chega com o nome da campanha e o funil do quiz mostra qual campanha traz gente boa. Precisa de onde o anúncio roda e do nome da campanha.",
      inputSchema: {
        fonte: z.string().describe("onde roda: meta, google, instagram…"),
        campanha: z.string().describe("nome da campanha"),
        midia: z.string().optional().describe("pago, story, orgânico…"),
        conteudo: z.string().optional().describe("qual anúncio ou criativo"),
        termo: z.string().optional().describe("palavra-chave (anúncio de busca)"),
      },
    },
    async ({ fonte, campanha, midia, conteudo, termo }) =>
      executar(async () => {
        const link = linkDoQuiz(`${origem}/quiz`, { fonte, campanha, midia, conteudo, termo });
        if (!link) throw new Error("Preciso de onde o anúncio roda e do nome da campanha.");
        return { link };
      }),
  );

  server.registerTool(
    "salvar_lead",
    {
      title: "Criar ou editar lead",
      description:
        "Cria um lead (sem id) ou edita (com id). Só os campos enviados mudam. Valor estimado em reais por mês; só grave o que a pessoa disse (ou o preço calculado do pacote). Datas em AAAA-MM-DD.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do lead"),
        nome: z.string().optional(),
        contato: z.string().optional(),
        telefone: z.string().optional(),
        email: z.string().optional(),
        instagram: z.string().optional(),
        origem: z.string().optional().describe("como chegou: Indicação, Instagram, Quiz, Landing ou Outro"),
        pacote: z.string().nullable().optional().describe("pacote de interesse (nome ou id)"),
        simulacao: z.string().nullable().optional().describe("proposta salva ligada ao lead (nome ou id da simulação); é dela que ganhar_lead tira as entregas do contrato"),
        valorEstimadoReais: opt(z.number().nonnegative(), "valor estimado por mês"),
        responsavel: z.string().nullable().optional().describe("sócio (nome ou id)"),
        proximoContato: z.string().nullable().optional(),
        proximaAcao: z.string().optional(),
        observacoes: z.string().optional(),
        comercialEstruturado: z
          .boolean()
          .nullable()
          .optional()
          .describe("o comercial do cliente está estruturado (quem atende e vende os leads)? Condição para oferecer tráfego com garantia"),
      },
    },
    async (e) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const leads = await repo.listarLeads();
        const antes = e.id ? resolver(leads.map((l) => ({ ...l })), e.id, "Lead") : null;
        if (!antes && !e.nome) throw new Error("Informe o nome do lead novo.");
        if (e.proximoContato && !/^\d{4}-\d{2}-\d{2}$/.test(e.proximoContato)) throw new Error("Data inválida. Use AAAA-MM-DD.");
        const base = antes ?? novoLead(novoId(), e.nome!);
        const l: Lead = {
          ...base,
          ...(e.nome != null && { nome: e.nome }),
          ...(e.contato != null && { contato: e.contato }),
          ...(e.telefone != null && { telefone: e.telefone }),
          ...(e.email != null && { email: e.email }),
          ...(e.instagram != null && { instagram: e.instagram }),
          ...(e.origem != null && { origem: e.origem }),
          ...(e.pacote !== undefined && { pacoteId: e.pacote ? resolver(config.pacotes ?? [], e.pacote, "Pacote").id : null }),
          ...(e.valorEstimadoReais !== undefined && { valorEstimadoCentavos: paraCentavos(e.valorEstimadoReais) }),
          ...(e.simulacao !== undefined && { simulacaoId: e.simulacao ? resolver(await repo.listarSimulacoes(), e.simulacao, "Proposta salva").id : null }),
          ...(e.responsavel !== undefined && { responsavelId: e.responsavel ? resolver(config.pessoas, e.responsavel, "Sócio").id : null }),
          ...(e.proximoContato !== undefined && { proximoContato: e.proximoContato }),
          ...(e.proximaAcao != null && { proximaAcao: e.proximaAcao }),
          ...(e.observacoes != null && { observacoes: e.observacoes }),
          ...(e.comercialEstruturado !== undefined && { comercialEstruturado: e.comercialEstruturado }),
        };
        await repo.salvarLead(l);
        return { salvo: l.nome, id: l.id, criado: !antes };
      }),
  );

  server.registerTool(
    "mover_lead",
    {
      title: "Mudar a etapa do lead",
      description:
        "lead_recebido, pesquisa (pesquisa de nicho e concorrência), contato_feito, reuniao (reunião comercial), proposta_enviada ou perdido (com motivo). Para GANHO use ganhar_lead, que também cria o cliente.",
      inputSchema: {
        id: z.string().describe("id ou nome do lead"),
        etapa: z.enum(["lead_recebido", "pesquisa", "contato_feito", "reuniao", "proposta_enviada", "perdido"]),
        motivoPerda: z.string().optional(),
      },
    },
    async ({ id, etapa, motivoPerda }) =>
      executar(async () => {
        const repo = await obterRepo();
        const l = resolver(await repo.listarLeads(), id, "Lead");
        const novo = { ...moverLead(l, etapa), ...(etapa === "perdido" && { motivoPerda: motivoPerda ?? "" }) };
        await repo.salvarLead(novo);
        return { lead: l.nome, etapa: rotuloEtapa(etapa) };
      }),
  );

  server.registerTool(
    "ganhar_lead",
    {
      title: "Lead fechou: virar cliente",
      description:
        "Marca o lead como ganho e cria o cliente, guardando o escopo a partir da proposta ligada (ou do pacote) com o valor estimado. Abaixo do piso de um sócio, o escopo vira pedido de exceção. Pacote de projeto avulso: o cliente nasce sem mensalidade, com o projeto fechado na ficha e uma tarefa por entrega do projeto (prazo em dias úteis). Confirme com quem está conversando antes.",
      inputSchema: { id: z.string().describe("id ou nome do lead") },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const l = resolver(await repo.listarLeads(), id, "Lead");
        // M16: sem proposta ligada, sem pacote e sem valor, o cliente nasceria sem valor nem entregas
        if (!l.simulacaoId && !l.pacoteId && l.valorEstimadoCentavos == null)
          throw new Error(
            `${l.nome} ainda não tem proposta, pacote nem valor. Antes de fechar, grave com salvar_lead o pacote (pacote) e o valor combinado (valorEstimadoReais), ou ligue a proposta salva (simulacao).`,
          );
        const r = await ganharLead(repo, config, l);
        if (r.tarefasDoProjeto)
          return {
            cliente: l.nome,
            clienteId: r.clienteId,
            projetoAvulso: "cliente sem mensalidade, com o projeto fechado guardado na ficha",
            tarefasCriadas: r.tarefasDoProjeto.map((t) => ({ titulo: t.titulo, responsavel: config.pessoas.find((p) => p.id === t.responsavelId)?.nome ?? null, prazo: t.vencimento })),
            contrato: "o contrato de valor único ainda não está pronto no Aden: avise quem está conversando",
          };
        return {
          cliente: l.nome,
          clienteId: r.clienteId,
          escopo: r.escopo == null ? "sem proposta nem pacote ligado" : r.escopo.gravado ? "guardado" : `esperando aprovação de ${r.escopo.abaixo.map((a) => a.nome).join(" e ")}`,
        };
      }),
  );

  server.registerTool(
    "registrar_conversa_lead",
    {
      title: "Registrar conversa com o lead",
      description:
        "Anota no histórico do lead o que foi conversado (nota, whatsapp, ligação, reunião, e-mail, proposta ou follow_up do \"vou ver\"). Opcional: já marca o próximo contato. Passando do máximo de follow-ups configurado, a resposta sugere marcar como perdido (só sugere).",
      inputSchema: {
        id: z.string().describe("id ou nome do lead"),
        texto: z.string(),
        tipo: z.enum(["nota", "ligacao", "whatsapp", "reuniao", "email", "proposta", "follow_up"]).optional(),
        proximoContato: z.string().optional().describe("AAAA-MM-DD"),
        proximaAcao: z.string().optional(),
      },
    },
    async ({ id, texto, tipo, proximoContato, proximaAcao }) =>
      executar(async () => {
        const repo = await obterRepo();
        const l = resolver(await repo.listarLeads(), id, "Lead");
        await repo.salvarInteracao({ id: novoId(), leadId: l.id, tipo: tipo ?? "nota", texto, em: new Date().toISOString(), autorNome: (await repo.usuarioAtual())?.nome ?? "Claude (conector)" });
        if (proximoContato || proximaAcao)
          await repo.salvarLead({ ...l, ...(proximoContato && { proximoContato }), ...(proximaAcao != null && { proximaAcao }) });
        const config = await repo.carregarConfig();
        const fu = situacaoFollowUp(l, await repo.listarInteracoes(l.id), config.empresa.followUpsMaximo);
        return {
          registrado: l.nome,
          followUpsFeitos: fu.feitos,
          sugestao: fu.sugerirPerda ? `Já foram ${fu.feitos} follow-ups (o máximo combinado). Pergunte se é hora de marcar ${l.nome} como perdido.` : null,
        };
      }),
  );

  // ─── Terceiros, pacotes e metas ───────────────────────────────────────────

  server.registerTool(
    "salvar_terceiro",
    {
      title: "Criar ou alterar terceiro (cobrado por saída)",
      description:
        "Serviço terceirizado cobrado por saída (ex.: Audiovisual: grava e edita). Custo do cliente = saídas × (valor por saída + deslocamento). Nunca rateado. Só grave valores que a pessoa disse. Ligue a um tipo de entrega com salvar_tipo_entrega (terceiro).",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do terceiro a alterar; vazio = novo"),
        nome: z.string().optional(),
        inclui: z.string().optional(),
        fraseCliente: z.string().optional().describe("o que o cliente lê, ex.: gravação e edição mensal inclusa"),
        valorPorSaidaReais: opt(z.number().nonnegative(), "valor por saída em reais"),
        deslocamentoMedioReais: opt(z.number().nonnegative(), "deslocamento médio por saída em reais"),
        ativo: z.boolean().optional(),
      },
    },
    async ({ id, valorPorSaidaReais, deslocamentoMedioReais, ...resto }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const lista = antes.terceiros ?? [];
        const patch = {
          ...resto,
          ...(valorPorSaidaReais !== undefined ? { valorPorSaidaCentavos: paraCentavos(valorPorSaidaReais) } : {}),
          ...(deslocamentoMedioReais !== undefined ? { deslocamentoMedioCentavos: paraCentavos(deslocamentoMedioReais) } : {}),
        };
        let terceiros;
        if (id) {
          const alvo = resolver(lista, id, "Terceiro");
          terceiros = lista.map((t) => (t.id === alvo.id ? aplicar(t, patch) : t));
        } else {
          if (!resto.nome) throw new Error("Informe o nome do serviço terceirizado.");
          terceiros = [
            ...lista,
            aplicar({ id: novoId(), nome: resto.nome, inclui: "", fraseCliente: "", valorPorSaidaCentavos: null, deslocamentoMedioCentavos: null, ativo: true }, patch),
          ];
        }
        return salvarDiferenca(repo, antes, { ...antes, terceiros });
      }),
  );

  server.registerTool(
    "ver_pacotes",
    {
      title: "Pacotes e preços calculados",
      description:
        "Pacotes fechados da negociação: frases que o cliente lê, entregas (rotina e primeiro mês) e os preços CALCULADOS (manutenção mensal e primeiro mês). Pacote de projeto avulso (avulso=true): sem mensalidade, valor único do projeto, prazo em dias úteis e parcelas (% no início, resto na entrega). Preço nunca é digitado.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const nome = (id: string) => config.tiposEntrega.find((t) => t.id === id)?.nome ?? id;
        return (config.pacotes ?? []).map((p) => {
          const preco = precoDoPacote(config, p);
          if (p.avulso) {
            const parc = parcelasDoProjeto(config, preco.mensalCentavos);
            return {
              id: p.id,
              nome: p.nome,
              avulso: true,
              ativo: p.ativo,
              descricao: p.descricao,
              oQueOClienteLe: frasesParaCliente(config, p, pacoteParaCenario(p)),
              projetoEExtras: p.rotina.map((i) => ({ entrega: nome(i.tipoEntregaId), quantidade: i.quantidade })),
              valorMinimoDoProjeto: paraReais(preco.mensalCentavos),
              prazoDiasUteis: prazoDoProjeto(config, p.rotina),
              pagamento: parc ? textoParcelas(parc) : "sem o % pago no início na configuração",
              motivoSemPreco: preco.motivo,
            };
          }
          return {
            id: p.id,
            nome: p.nome,
            avulso: false,
            padrao: p.padrao,
            ativo: p.ativo,
            descricao: p.descricao,
            oQueOClienteLe: frasesParaCliente(config, p, pacoteParaCenario(p)),
            rotinaMensal: p.rotina.map((i) => ({ entrega: nome(i.tipoEntregaId), quantidade: i.quantidade })),
            primeiroMes: p.entrada.map((i) => ({ entrega: nome(i.tipoEntregaId), quantidade: i.quantidade ?? "a confirmar" })),
            manutencaoMensal: paraReais(preco.mensalCentavos),
            primeiroMesValor: preco.entradaAConfirmar ? "a confirmar (faltam quantidades)" : paraReais(preco.entradaCentavos),
            motivoSemPreco: preco.motivo,
          };
        });
      }),
  );

  server.registerTool(
    "salvar_pacote",
    {
      title: "Criar ou alterar pacote",
      description:
        "Pacote fechado para a negociação: nome, descrição para o cliente, frases do que está incluso e as entregas (rotina mensal e primeiro mês). avulso=true = projeto avulso sem mensalidade: as entregas do projeto (e os extras) vão em rotina, e primeiroMes fica vazio. NÃO existe campo de preço: sai do cálculo. Quantidade null = a confirmar. Listas enviadas substituem as antigas.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do pacote a alterar; vazio = novo"),
        nome: z.string().optional(),
        descricao: z.string().optional(),
        frasesCliente: z.array(z.string()).optional(),
        rotina: z.array(z.object({ entrega: z.string(), quantidade: z.number().nonnegative().nullable() })).optional(),
        primeiroMes: z.array(z.object({ entrega: z.string(), quantidade: z.number().nonnegative().nullable() })).optional(),
        padrao: z.boolean().optional(),
        ativo: z.boolean().optional(),
        avulso: z.boolean().optional().describe("true = projeto avulso (pago uma vez, sem mensalidade)"),
      },
    },
    async ({ id, nome, descricao, frasesCliente, rotina, primeiroMes, padrao, ativo, avulso }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        const lista = antes.pacotes ?? [];
        const itens = (l: { entrega: string; quantidade: number | null }[]) =>
          l.map((i) => ({ tipoEntregaId: resolver(antes.tiposEntrega, i.entrega, "Tipo de entrega").id, quantidade: i.quantidade }));
        const alvo = id ? resolver(lista, id, "Pacote") : null;
        if (!alvo && !nome) throw new Error("Informe o nome do pacote novo.");
        const base: Pacote = alvo ?? { id: novoId(), nome: nome!, descricao: "", itensCliente: [], rotina: [], entrada: [], padrao: lista.length === 0, ativo: true };
        const novo: Pacote = {
          ...base,
          ...(nome != null && { nome }),
          ...(descricao != null && { descricao }),
          ...(frasesCliente && { itensCliente: frasesCliente }),
          ...(rotina && { rotina: itens(rotina) }),
          ...(primeiroMes && { entrada: itens(primeiroMes) }),
          ...(padrao != null && { padrao }),
          ...(ativo != null && { ativo }),
          ...(avulso != null && { avulso }),
        };
        if (novo.avulso) {
          novo.entrada = [];
          novo.padrao = false;
        }
        const pacotes = alvo ? lista.map((p) => (p.id === alvo.id ? novo : novo.padrao ? { ...p, padrao: false } : p)) : [...lista.map((p) => (novo.padrao ? { ...p, padrao: false } : p)), novo];
        await salvarDiferenca(repo, antes, { ...antes, pacotes });
        const preco = precoDoPacote({ ...antes, pacotes }, novo);
        if (novo.avulso) return { salvo: novo.nome, avulso: true, valorMinimoDoProjeto: paraReais(preco.mensalCentavos), prazoDiasUteis: prazoDoProjeto({ ...antes, pacotes }, novo.rotina) };
        return { salvo: novo.nome, manutencaoMensal: paraReais(preco.mensalCentavos), primeiroMes: preco.entradaAConfirmar ? "a confirmar" : paraReais(preco.entradaCentavos) };
      }),
  );

  server.registerTool(
    "ver_projetos_que_cabem",
    {
      title: "Projetos avulsos que cabem no valor do cliente",
      description:
        "Modo valor para projeto pago uma vez: com quanto o cliente pode pagar (reais), lista os pacotes de projeto avulso ativos do mais barato ao mais caro, o valor mínimo calculado de cada um, o prazo em dias úteis, se cabe, quanto sobra ou falta e o valor por hora de cada sócio nesse valor. Sem valor: só a lista com os preços.",
      inputSchema: { valorReais: z.number().positive().optional().describe("quanto o cliente pode pagar pelo projeto, em reais") },
    },
    async ({ valorReais }) =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const lista = projetosQueCabem(config, valorReais != null ? paraCentavos(valorReais) : null);
        if (!lista.length) return { projetos: [], aviso: "Nenhum pacote de projeto avulso ativo (Configurações → Pacotes)." };
        return {
          projetos: lista.map((p) => ({
            pacote: p.nome,
            valorMinimo: paraReais(p.precoCentavos),
            prazoDiasUteis: p.prazoDiasUteis,
            cabe: p.cabe,
            ...(p.folgaCentavos != null && (p.folgaCentavos >= 0 ? { sobra: paraReais(p.folgaCentavos) } : { falta: paraReais(-p.folgaCentavos) })),
            porHora: p.porHora.map((x) => ({ socio: x.nome, porHora: paraReais(x.valorHoraCentavos), abaixoDoPiso: x.abaixoPiso })),
          })),
        };
      }),
  );

  server.registerTool(
    "salvar_meta",
    {
      title: "Criar ou alterar degrau da trilha de metas",
      description:
        "Degrau da trilha de crescimento (tela Mês, aba Resumo). SÓ cadastre metas que os sócios definiram na conversa; nunca invente. Critério: faturamento_mensal (alvo em reais), clientes (quantidade), recebido_socio (reais por sócio no mês), uso_capacidade (%). A ordem é a da lista (posicao começa em 1).",
      inputSchema: {
        id: z.string().optional().describe("id ou nome do degrau a alterar; vazio = novo"),
        nome: z.string().optional(),
        criterio: z.enum(["faturamento_mensal", "clientes", "recebido_socio", "uso_capacidade"]).optional(),
        alvo: z.number().positive().optional().describe("reais, quantidade de clientes ou %"),
        acao: z.string().optional().describe("o que fazer ao chegar lá"),
        posicao: z.number().int().positive().optional(),
      },
    },
    async ({ id, nome, criterio, alvo, acao, posicao }) =>
      executar(async () => {
        const repo = await obterRepo();
        const antes = await repo.carregarConfig();
        let lista = [...(antes.metas ?? [])];
        const existente = id ? resolver(lista, id, "Meta") : null;
        if (!existente && !nome) throw new Error("Informe o nome do degrau.");
        const crit = criterio ?? existente?.criterio ?? null;
        const alvoInterno = alvo === undefined ? undefined : crit && unidadeDoCriterio(crit) === "moeda" ? paraCentavos(alvo) : alvo;
        const m: Meta = {
          ...(existente ?? { id: novoId(), nome: nome!, criterio: null, alvo: null, acao: "", conquistadaEm: null }),
          ...(nome != null && { nome }),
          ...(criterio != null && { criterio }),
          ...(alvoInterno !== undefined && { alvo: alvoInterno }),
          ...(acao != null && { acao }),
        };
        lista = lista.filter((x) => x.id !== m.id);
        const pos = posicao != null ? Math.min(posicao - 1, lista.length) : existente ? (antes.metas ?? []).findIndex((x) => x.id === m.id) : lista.length;
        lista.splice(pos, 0, m);
        return salvarDiferenca(repo, antes, { ...antes, metas: lista });
      }),
  );

  server.registerTool(
    "ver_metas",
    {
      title: "Trilha de metas",
      description: "Degraus da trilha de crescimento: valor atual, alvo, progresso, quanto falta, conquistados (com data), o degrau atual e quantos clientes do pacote padrão ainda cabem.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const visao = calcularVisaoMes(config);
        const t = calcularTrilha(config, visao);
        const fmt = (crit: Meta["criterio"], v: number | null) => (v == null || !crit ? v : unidadeDoCriterio(crit) === "moeda" ? paraReais(v) : Math.round(v * 10) / 10);
        const padrao = pacotePadrao(config);
        const espaco = padrao ? espacoPraVender(config, padrao, visao) : null;
        return {
          degraus: t.degraus.map((d, i) => ({
            posicao: i + 1,
            nome: d.meta.nome,
            criterio: d.meta.criterio,
            alvo: fmt(d.meta.criterio, d.meta.alvo),
            atual: fmt(d.meta.criterio, d.valor),
            falta: fmt(d.meta.criterio, d.falta),
            progressoPct: d.progressoPct == null ? null : Math.round(d.progressoPct),
            conquistada: d.batida,
            conquistadaEm: d.meta.conquistadaEm,
            acao: d.meta.acao,
          })),
          degrauAtual: t.atual == null ? null : t.atual + 1,
          cabemMaisDoPacotePadrao: espaco ? { pacote: espaco.pacote.nome, cabem: espaco.cabem, faltaParaCalcular: espaco.faltando } : "nenhum pacote padrão",
        };
      }),
  );
}
