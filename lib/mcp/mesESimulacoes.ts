// Ferramentas do conector: mesESimulacoes. Movidas de servidor.ts sem mudar nenhuma.

import type { RepositorioSupabase } from "../dados/supabase";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { calcularSaudeCliente, calcularVisaoMes, horasInvestidasNaAden, rotuloOrigemHoras } from "../calculo/mes";
import { calcularTrilha, espacoPraVender } from "../calculo/metas";
import { calcularCenario } from "../calculo/motor";
import { novoId } from "../calculo/novo";
import { pacotePadrao, pacoteParaCenario, projetosQueCabem } from "../calculo/pacotes";
import { somaPagamentos } from "../calculo/pagamentos";
import { calcularSolucoes } from "../calculo/solucoes";
import type {  } from "../calculo/tipos";
import { guardarEscopo } from "../dados/acoes";
import { competenciaAtual } from "../dados/repositorio";
import { cenarioParaConversa, cenarioParaInterno, paraCentavos, paraReais, resolver, resultadoParaConversa, zCenarioConversa } from "./traducao";
import { z } from "zod";
import { executar, opt, zCompetencia } from "./comum";

export function registrarMesESimulacoes(server: McpServer, obterRepo: () => Promise<RepositorioSupabase>) {
  // ─── Mês inteiro e saúde dos clientes ─────────────────────────────────────

  server.registerTool(
    "ver_visao_do_mes",
    {
      title: "Mês: resumo e capacidade",
      description:
        "Espaço para vender: quantos clientes do pacote padrão ainda cabem (pelas horas livres), a trilha de metas (degrau atual e quanto falta), horas de cada sócio e de cada cliente, faturamento e teto do regime. Fale em tom de crescimento: quando não couber mais, é hora do próximo passo da trilha.",
      inputSchema: {},
    },
    async () =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const v = calcularVisaoMes(config);
        const padrao = pacotePadrao(config);
        const espaco = padrao ? espacoPraVender(config, padrao, v) : null;
        const trilha = calcularTrilha(config, v);
        const atual = trilha.atual != null ? trilha.degraus[trilha.atual] : null;
        return {
          espacoParaVender: espaco
            ? { pacotePadrao: padrao!.nome, cabemMais: espaco.cabem, faltaParaCalcular: espaco.faltando }
            : "nenhum pacote padrão marcado",
          degrauAtual: atual ? { nome: atual.meta.nome, progressoPct: atual.progressoPct == null ? null : Math.round(atual.progressoPct), acao: atual.meta.acao } : null,
          socios: v.socios.map((s) => ({
            nome: s.nome,
            capacidadeHorasMes: s.capacidadeHorasMes,
            horasUsadasPelosClientes: s.horasUsadas,
            horasLivres: s.horasLivres,
            usoPct: s.usoPct,
            situacao: s.situacao,
          })),
          clientes: v.clientes.map((c) => ({ nome: c.nome, temEscopo: c.temEscopo, horasTotais: c.horasTotais, valorMensal: paraReais(c.valorMensalCentavos) })),
          clientesSemEscopo_horasNaoContadas: v.semEscopo,
          faturamentoMensal: paraReais(v.faturamentoMensalCentavos),
          tetoDoRegime: v.teto ? { projecaoAnual: paraReais(v.teto.anualCentavos), teto: paraReais(v.teto.tetoCentavos), pct: v.teto.pct, nivel: v.teto.nivel } : null,
        };
      }),
  );

  server.registerTool(
    "definir_escopo_cliente",
    {
      title: "Definir escopo contratado do cliente",
      description:
        "Guarda o escopo contratado de um cliente ativo (entregas, custos, tráfego…), no mesmo formato de calcular_cenario, e o valor como mensalidade do contrato. Atalho: pacote (nome ou id, ver_pacotes) usa as entregas do pacote e mantém o valor mensal já combinado do cliente, igual à ficha. Se algum sócio ficar abaixo do piso, NÃO grava: vira pedido de exceção para o sócio afetado aprovar. Confirme antes de substituir um escopo existente.",
      inputSchema: {
        cliente: z.string().describe("cliente (nome ou id)"),
        cenario: zCenarioConversa.nullable().optional().describe("escopo; null remove"),
        pacote: z.string().optional().describe("no lugar do cenario: nome ou id do pacote"),
      },
    },
    async ({ cliente, cenario, pacote }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const alvo = resolver(config.clientes, cliente, "Cliente");
        if (pacote) {
          const pk = resolver(config.pacotes ?? [], pacote, "Pacote");
          if (pk.avulso) throw new Error(`${pk.nome} é projeto avulso (pago uma vez): não vira entregas do contrato mensal. Para fechar o projeto, use salvar_lead com o pacote e ganhar_lead.`);
          const base = pacoteParaCenario(pk);
          const cen = alvo.valorMensalCentavos ? { ...base, modo: "valor" as const, mensalidadeCentavos: alvo.valorMensalCentavos } : base;
          const r = await guardarEscopo(repo, config, alvo.id, { ...cen, clienteId: alvo.id });
          return {
            cliente: alvo.nome,
            pacote: pk.nome,
            valorMensal: paraReais(r.valorCentavos),
            gravado: r.gravado || r.pedido?.status === "aplicado",
            situacao: r.gravado ? "Escopo do pacote guardado." : `Ficou abaixo do piso de ${r.abaixo.map((x) => x.nome).join(" e ")}: pedido de exceção esperando aprovação no site.`,
          };
        }
        if (cenario === undefined) throw new Error("Mande o cenario ou o pacote.");
        if (!cenario) {
          await repo.definirEscopoCliente(alvo.id, null);
          return { cliente: alvo.nome, escopoRemovido: true };
        }
        const r = await guardarEscopo(repo, config, alvo.id, { ...cenarioParaInterno(cenario, config), clienteId: alvo.id });
        const nome = (id: string) => config.pessoas.find((p) => p.id === id)?.nome ?? id;
        return {
          cliente: alvo.nome,
          valorMensal: paraReais(r.valorCentavos),
          gravado: r.gravado || r.pedido?.status === "aplicado",
          abaixoDoPiso: r.abaixo.map((x) => ({ socio: x.nome, perdaPorMes: paraReais(x.perdaMensalCentavos) })),
          situacao: r.gravado
            ? "Escopo guardado."
            : r.pedido?.status === "aplicado"
              ? "Guardado como exceção (o afetado é quem pediu)."
              : `Não gravado: fica abaixo do piso. Pedido de exceção esperando ${r.pedido?.aguardando.map(nome).join(" e ")} aprovar no site.`,
        };
      }),
  );

  server.registerTool(
    "ver_saude_clientes",
    {
      title: "Mês: cada cliente (saúde)",
      description:
        "Para cada cliente pagante ativo: previsto (escopo + contrato) × realizado (horas corrigidas à mão ou, sem correção, entregas do contrato × tempo cadastrado; o cronômetro é opcional e não entra na conta; valor dos pagamentos), valor por hora de cada sócio contra o piso, de onde vem cada número de horas e, quando há problema, os caminhos calculados: subir o valor, cortar escopo, misto, ou aceitar a exceção (quanto cada sócio perde por mês). A própria Aden (cliente interno) fica fora da lista: suas horas vêm em investidoNaAden.",
      inputSchema: { competencia: zCompetencia },
    },
    async ({ competencia }) =>
      executar(async () => {
        const repo = await obterRepo();
        const mes = competencia ?? competenciaAtual();
        const [config, registros, pagamentos, tarefas] = await Promise.all([repo.carregarConfig(), repo.carregarMes(mes), repo.listarPagamentos(), repo.listarTarefas()]);
        return {
          competencia: mes,
          investidoNaAden: config.clientes.some((c) => c.ativo && c.interno)
            ? horasInvestidasNaAden(config, tarefas, mes).map((x) => ({ socio: x.nome, horas: Math.round(x.horas * 10) / 10, tarefasConcluidas: x.tarefas, semTempoCadastrado: x.semTempo }))
            : null,
          clientes: config.clientes
            .filter((c) => c.ativo && !c.interno)
            .map((c) => {
              const s = calcularSaudeCliente(config, c, registros[c.id] ?? null, {
                pagamentosCentavos: somaPagamentos(pagamentos, c.id, mes),
                mesFechado: mes < competenciaAtual(),
              });
              const sol = calcularSolucoes(config, c, s);
              return {
                nome: s.nome,
                bloqueado: s.bloqueio?.texto ?? null,
                temEscopo: s.temEscopo,
                valorContrato: paraReais(s.valorContratoCentavos),
                valorUsadoNoMes: paraReais(s.valorRealCentavos),
                deOndeVemOValor: s.origemValor,
                horasPrevistas: s.horasPrevistas,
                horasReais: s.horasReais,
                pagaPorHoraPrevisto: paraReais(s.valorCobradoHoraPrevisto),
                pagaPorHoraReal: paraReais(s.valorCobradoHoraReal),
                prejuizoSilencioso: s.prejuizoSilencioso,
                contratadoAbaixoDoPiso: s.contratadoAbaixoDoPiso,
                socios: s.socios.map((x) => ({
                  nome: x.nome,
                  piso: paraReais(x.piso),
                  horasPrevistas: x.horasPrevistas,
                  horasReais: x.horasReais,
                  origemDasHoras: rotuloOrigemHoras(x.origemHoras),
                  semRegistro: x.semRegistro,
                  recebe: paraReais(x.valorReal),
                  porHoraPrevisto: paraReais(x.valorHoraPrevisto),
                  porHoraReal: paraReais(x.valorHoraReal),
                  abaixoDoPiso: x.abaixoPisoReal,
                  recebeSemHoras: x.recebeSemHoras,
                })),
                caminhos: sol.temProblema
                  ? {
                      calculadoCom: sol.base === "real" ? "horas reais do mês" : "o contrato",
                      faltaDado: sol.faltando,
                      subirOValor: sol.subir ? { mensalidade: paraReais(sol.subir.mensalidadeCentavos), aMais: paraReais(sol.subir.aMaisCentavos) } : null,
                      cortarEscopo: sol.cortar.map((x) => ({ tirar: x.tirar, entrega: x.nome })),
                      corteDeUmTipoSoNaoResolve: sol.corteSozinhoNaoResolve,
                      misto: sol.misto.map((x) => ({ tirar: x.tirar, entrega: x.nome, mensalidade: paraReais(x.mensalidadeCentavos), aMais: paraReais(x.aMaisCentavos) })),
                      aceitarExcecao: sol.excecao.map((x) => ({ socio: x.nome, perdePorMes: paraReais(x.perdaMensalCentavos), precisaAprovacaoDe: x.nome })),
                    }
                  : null,
              };
            }),
        };
      }),
  );

  server.registerTool(
    "registrar_mes_cliente",
    {
      title: "Registrar horas reais e valor recebido",
      description:
        "Lança, para um cliente e um mês, as horas reais de cada sócio (lançamento manual). Para dinheiro que entrou, use registrar_pagamento. Só registre números que foram informados na conversa.",
      inputSchema: {
        cliente: z.string().describe("cliente (nome ou id)"),
        competencia: zCompetencia,
        valorRecebidoReais: opt(z.number().nonnegative(), "lançamento antigo de quanto entrou; prefira registrar_pagamento"),
        horas: z.record(z.string(), z.number().nullable()).optional().describe("sócio (nome ou id) → horas reais no mês"),
      },
    },
    async ({ cliente, competencia, valorRecebidoReais, horas }) =>
      executar(async () => {
        const repo = await obterRepo();
        const mes = competencia ?? competenciaAtual();
        const config = await repo.carregarConfig();
        const alvo = resolver(config.clientes, cliente, "Cliente");
        const socios = config.pessoas.filter((p) => p.socio);
        const atual = (await repo.carregarMes(mes))[alvo.id] ?? { valorRecebidoCentavos: null, horas: {} };
        const registro = {
          valorRecebidoCentavos: valorRecebidoReais === undefined ? atual.valorRecebidoCentavos : paraCentavos(valorRecebidoReais),
          horas: {
            ...atual.horas,
            ...Object.fromEntries(Object.entries(horas ?? {}).map(([ref, h]) => [resolver(socios, ref, "Sócio").id, h])),
          },
        };
        await repo.salvarMesCliente(mes, alvo.id, registro);
        const s = calcularSaudeCliente(config, alvo, registro);
        return { cliente: alvo.nome, competencia: mes, prejuizoSilencioso: s.prejuizoSilencioso, pagaPorHoraReal: paraReais(s.valorCobradoHoraReal) };
      }),
  );

  // ─── Calculadora e simulações ─────────────────────────────────────────────

  server.registerTool(
    "calcular_cenario",
    {
      title: "Calcular um cenário",
      description:
        "Roda a calculadora de projeto sem salvar. Modo escopo: valor mínimo. Modo valor: sobra, parte e valor/hora de cada sócio e o que cabe. Mostra também entrada, horizonte e alertas.",
      inputSchema: { cenario: zCenarioConversa },
    },
    async ({ cenario }) =>
      executar(async () => {
        const config = await (await obterRepo()).carregarConfig();
        const interno = cenarioParaInterno(cenario, config);
        const r = resultadoParaConversa(calcularCenario(config, interno));
        // projeto avulso no modo valor: os pacotes de projeto que cabem no valor (mesma conta de ver_projetos_que_cabem)
        if (interno.avulso && interno.modo === "valor")
          return {
            ...r,
            projetosQueCabem: projetosQueCabem(config, interno.mensalidadeCentavos).map((p) => ({ pacote: p.nome, valorMinimo: paraReais(p.precoCentavos), prazoDiasUteis: p.prazoDiasUteis, cabe: p.cabe })),
          };
        return r;
      }),
  );

  server.registerTool(
    "listar_simulacoes",
    { title: "Listar simulações salvas", description: "Simulações da calculadora, da mais recente para a mais antiga.", inputSchema: {} },
    async () => executar(async () => (await obterRepo()).listarSimulacoes()),
  );

  server.registerTool(
    "ver_simulacao",
    {
      title: "Ver simulação salva",
      description: "Cenários da simulação (no mesmo formato aceito por calcular_cenario e salvar_simulacao) e o resultado calculado com a configuração atual.",
      inputSchema: { id: z.string().describe("id ou nome da simulação") },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const lista = await repo.listarSimulacoes();
        const alvo = resolver(lista, id, "Simulação");
        const sim = await repo.carregarSimulacao(alvo.id);
        if (!sim) throw new Error("Simulação não encontrada.");
        const config = await repo.carregarConfig();
        return {
          id: sim.id,
          nome: sim.nome,
          cenarios: sim.cenarios.map((c) => ({
            cenario: cenarioParaConversa(c, config),
            resultado: resultadoParaConversa(calcularCenario(config, c)),
          })),
        };
      }),
  );

  server.registerTool(
    "salvar_simulacao",
    {
      title: "Salvar simulação",
      description:
        "Cria ou substitui uma simulação com até 3 cenários (aparece no site em Calculadora → Abrir simulação salva). Com id, substitui os cenários daquela simulação.",
      inputSchema: {
        id: z.string().optional().describe("id ou nome de uma simulação existente para substituir; vazio = nova"),
        nome: z.string(),
        cenarios: z.array(zCenarioConversa.extend({ id: z.string().optional() })).min(1).max(3),
      },
    },
    async ({ id, nome, cenarios }) =>
      executar(async () => {
        const repo = await obterRepo();
        const config = await repo.carregarConfig();
        const simId = id ? resolver(await repo.listarSimulacoes(), id, "Simulação").id : novoId();
        const internos = cenarios.map((c) => cenarioParaInterno(c, config, c.id));
        const resultados = internos.map((c) => calcularCenario(config, c));
        await repo.salvarSimulacao({ id: simId, nome, cenarios: internos }, resultados, config);
        return { salva: true, id: simId, nome, resultados: resultados.map(resultadoParaConversa) };
      }),
  );

  server.registerTool(
    "remover_simulacao",
    {
      title: "Remover simulação",
      description: "Apaga uma simulação salva (fica registrado no histórico). Confirme antes.",
      inputSchema: { id: z.string().describe("id ou nome da simulação") },
    },
    async ({ id }) =>
      executar(async () => {
        const repo = await obterRepo();
        const alvo = resolver(await repo.listarSimulacoes(), id, "Simulação");
        await repo.removerSimulacao(alvo.id);
        return { removida: alvo.nome };
      }),
  );
}
