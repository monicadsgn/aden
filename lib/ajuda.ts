// Textos de ajuda do sistema, em português simples. Um lugar só para:
// - o botão "?" de cada tela (até 3 frases: pra que serve e quando usar)
// - o glossário (uma frase + um exemplo por termo)
// - o tour de primeira vez (até 6 passos)
// Os exemplos usam números ilustrativos; os números de verdade vêm da configuração.

export interface AjudaTela {
  titulo: string;
  texto: string;
  /** termos do glossário ligados a esta tela */
  termos?: string[];
}

export const AJUDA_TELAS: Record<string, AjudaTela> = {
  "/hoje": {
    titulo: "Visão do dia",
    texto:
      "É por aqui que cada um começa o dia: o que tem para resolver hoje, o que está atrasado, o que depende de você e um resumo das metas, do comercial e do financeiro. Clique nos números do topo para ver a lista de cada um. Sócios podem olhar as pendências um do outro no seletor do canto.",
    termos: ["escopo"],
  },
  "/crm": {
    titulo: "Leads",
    texto:
      "Cada pessoa interessada na Aden, da primeira mensagem até fechar. Anote cada conversa na ficha do lead e marque o próximo contato: ele aparece na sua Visão do dia. Quando fechar, um clique cria o cliente com a proposta combinada.",
    termos: ["lead", "escopo"],
  },
  "/clientes": {
    titulo: "Clientes e contratos",
    texto:
      "A ficha de cada cliente é o único lugar dos dados dele: contato, contrato, escopo, tarefas, pagamentos e a conversa de antes de fechar. Preencha o dia do pagamento e as datas do contrato: o que vence aparece na sua Visão do dia. Para mudar o que ele recebe, use \"Personalizar escopo\" na aba Contrato.",
    termos: ["escopo", "rateio"],
  },
  "/calendario": {
    titulo: "Calendário",
    texto: "As tarefas no tempo, do início ao prazo, junto com os seus compromissos do Google Agenda. Clique num dia para ver o que tem nele ou criar uma tarefa ali. Dá para ver só as suas tarefas, as de outro sócio ou de todo mundo.",
  },
  "/calendario#datas": {
    titulo: "Datas comemorativas",
    texto:
      "As datas que entram no planejamento de cada cliente. Ligue a data ao cliente e diga com quantos dias de antecedência a campanha começa; elas aparecem quando o Claude monta o planejamento do mês.",
  },
  "/calculadora": {
    titulo: "Calculadora de projeto",
    texto:
      "É a proposta vista por dentro, só para os sócios: mostra se o preço paga os custos e a hora de cada um. Monte as entregas do mês e veja o valor e quanto fica para cada sócio; tráfego, projetos pontuais e percentuais ficam em \"Mais opções\", e o passo a passo da conta em \"Ver a conta inteira\". Clique no título de qualquer bloco para ver o que ele significa.",
    termos: ["escopo", "piso", "rateio", "sobra", "valor-por-hora"],
  },
  "/negociacao": {
    titulo: "Proposta",
    texto:
      "A tela para mostrar ao cliente na conversa: escolha um pacote e personalize na hora; ele vê só entregas e valor, e o botão \"Só para os sócios\" abre os números internos (use longe da tela dele). O pontinho ao lado do valor é um sinal só para você, sem palavra para o cliente entender: verde = o preço paga o piso de cada sócio e cabe nas horas do mês; vermelho = algum sócio fica abaixo do piso, as horas não cabem ou a conta fecha no negativo (o PDF espera a aprovação do sócio afetado); cinza = ainda falta dado para calcular.",
    termos: ["escopo", "piso"],
  },
  "/tarefas": {
    titulo: "Tarefas",
    texto:
      "Tudo o que está em produção, agrupado por prazo. As horas de cada entrega saem do tempo cadastrado em Configurações → Tipos de entrega. Se não souber quanto uma entrega leva, abra a tarefa e use \"Medir o tempo\" (opcional): ele nunca liga sozinho.",
    termos: ["tempo-por-entrega", "calibragem"],
  },
  "/mes#resumo": {
    titulo: "Mês · Resumo e metas",
    texto:
      "Mostra onde a Aden está na trilha de crescimento e quanto espaço ainda tem para vender. O primeiro número diz quantos clientes do pacote padrão ainda cabem com as horas livres de hoje. As outras abas trazem cada cliente e o que cada sócio recebeu; o botão Relatórios gera os PDFs.",
    termos: ["capacidade", "teto-mei"],
  },
  "/mes#horas": {
    titulo: "Mês · Horas",
    texto: "O detalhe das horas: quanto cada cliente pede de cada sócio e quanto sobra para cada um no mês. Use para redistribuir o trabalho ou planejar a próxima contratação.",
    termos: ["capacidade", "tempo-por-entrega"],
  },
  "/mes#clientes": {
    titulo: "Mês · Cada cliente",
    texto:
      "Uma linha por cliente: quanto pagou no mês, quantas horas custou (vindas do relógio das tarefas) e quanto isso dá por hora. Clique no cliente para ver o detalhe e, se ficar abaixo do piso, os caminhos: subir o valor, cortar entregas ou os dois. Use no fim de cada mês.",
    termos: ["piso", "valor-por-hora", "escopo"],
  },
  "/mes#cima": {
    titulo: "Mês visto de cima",
    texto:
      "De cima para baixo: o que entrou no mês, o imposto, os custos, o tráfego próprio da Aden e quanto fica para cada sócio, pela regra que vocês combinaram. Custos pagos do bolso de um sócio aparecem à parte e não saem do caixa. A barra mostra quanto falta para a virada, quando a divisão passa a ser meio a meio.",
    termos: ["sobra", "ordem-distribuicao"],
  },
  "/mes#socios": {
    titulo: "Mês · Sócios",
    texto: "Mostra quanto cada sócio já tem para receber no mês, com base nos pagamentos que entraram. Use na hora de fazer o repasse (a transferência para cada sócio).",
    termos: ["sobra", "reinvestimento", "ordem-distribuicao"],
  },
  "/calibragem": {
    titulo: "Calibragem das horas",
    texto:
      "Vale o tempo cadastrado. Quando alguém mede uma entrega pelo cronômetro (opcional), a média aparece aqui ao lado do tempo cadastrado; se ficar diferente, o sistema sugere atualizar, e vocês decidem.",
    termos: ["calibragem", "tempo-por-entrega"],
  },
  "/pagamentos": {
    titulo: "Pagamentos",
    texto:
      "Anote aqui cada pagamento que cai, com o mês a que ele se refere. O sistema mostra quanto de cada pagamento vai para custos, empresa e cada sócio, e quem está atrasado. Use sempre que entrar dinheiro de cliente.",
    termos: ["ordem-distribuicao"],
  },
  "/pdfs": {
    titulo: "Relatórios",
    texto:
      "Gera os documentos para baixar: a proposta para o cliente, o resumo para o contador e o relatório de cada sócio. Cada um mostra só o que aquela pessoa pode ver.",
  },
  "/aprovacoes#pedidos": {
    titulo: "Pedidos entre sócios",
    texto:
      "Mudanças que mexem no bolso de um sócio (piso, percentual, divisão de horas, tempo por entrega) só valem depois que ele aprova. Aqui ficam os pedidos esperando resposta, e o histórico de tudo que foi decidido.",
    termos: ["piso", "excecao"],
  },
  "/aprovacoes#avisos": {
    titulo: "Avisos",
    texto: "Recados do sistema para você: quem mudou o quê, e quanto isso muda no seu bolso por mês. Marque como lido depois de ver.",
  },
  "/configuracoes": {
    titulo: "Configurações",
    texto:
      "Em dois grupos: configurações do sistema (sócios, custos, regras, acessos) e comerciais (serviços, entregas, terceiros, pacotes, contrato, onboarding, briefing). Tudo aqui se configura uma vez, na ordem dos números: sem eles a proposta não tem o que calcular. As abas com \"falta preencher\" têm campo vazio; o histórico de alterações fica no botão do topo.",
    termos: ["piso", "capacidade", "rateio", "reinvestimento", "ordem-distribuicao"],
  },
  "/historico": {
    titulo: "Histórico de alterações",
    texto: "Tudo o que foi mudado no sistema, por quem e quando, com o valor de antes e o de depois. Ninguém consegue apagar. Use quando quiser entender por que um número mudou.",
  },
  "/glossario": {
    titulo: "Glossário",
    texto: "As palavras que o sistema usa, cada uma com uma frase e um exemplo. Volte aqui sempre que um termo não fizer sentido.",
  },
};

export interface Termo {
  id: string;
  termo: string;
  frase: string;
  exemplo: string;
}

export const GLOSSARIO: Termo[] = [
  {
    id: "lead",
    termo: "Lead",
    frase: "Alguém que mostrou interesse na Aden mas ainda não fechou. Fica em Leads até virar cliente (ganho) ou desistir (perdido).",
    exemplo: "Uma loja que mandou mensagem no Instagram pedindo orçamento é um lead na etapa \"Lead recebido\".",
  },
  {
    id: "piso",
    termo: "Piso (por hora)",
    frase: "O mínimo que uma hora de trabalho de cada sócio precisa pagar. Abaixo disso, o trabalho não vale a pena.",
    exemplo: "Com piso de R$ 50/h, um cliente que toma 20 h por mês precisa deixar pelo menos R$ 1.000 para esse sócio.",
  },
  {
    id: "capacidade",
    termo: "Capacidade",
    frase: "Quantas horas por mês cada sócio tem de verdade para produzir.",
    exemplo: "Se a Moni tem 100 h no mês e os clientes já pedem 85 h, sobram só 15 h para um cliente novo.",
  },
  {
    id: "rateio",
    termo: "Rateio",
    frase: "A divisão dos custos fixos da empresa (ferramentas, imposto do MEI) entre os clientes. Vai embutido na mensalidade.",
    exemplo: "R$ 800 de custos fixos divididos igualmente por 4 clientes dão R$ 200 para cada.",
  },
  {
    id: "reinvestimento",
    termo: "Reinvestimento",
    frase: "A parte da sobra que fica guardada na empresa, antes de dividir entre os sócios.",
    exemplo: "Com 10% de reinvestimento, de uma sobra de R$ 1.000 ficam R$ 100 na empresa e R$ 900 são divididos.",
  },
  {
    id: "sobra",
    termo: "Sobra",
    frase: "O que fica do que o cliente paga depois de tirar custos, imposto e taxas. É isso que vira dinheiro dos sócios.",
    exemplo: "Cliente paga R$ 2.000, saem R$ 500 de custos e R$ 100 de imposto: a sobra é R$ 1.400.",
  },
  {
    id: "escopo",
    termo: "Escopo",
    frase: "A lista do que vai ser entregue ao cliente por mês.",
    exemplo: "12 posts, 4 carrosséis e 1 reunião mensal.",
  },
  {
    id: "valor-por-hora",
    termo: "Valor por hora",
    frase: "Quanto cada sócio ganha, na prática, por hora trabalhada naquele cliente. É o número que diz se o cliente vale a pena.",
    exemplo: "Se a Moni recebe R$ 900 de um cliente e trabalha 15 h nele, ganha R$ 60 por hora.",
  },
  {
    id: "teto-mei",
    termo: "Teto do MEI",
    frase: "O limite de faturamento por ano que o MEI pode ter. Passou dele, a empresa muda de regime e paga outro imposto.",
    exemplo: "Se o teto fosse R$ 80.000 por ano, 5 clientes de R$ 1.500 somariam R$ 90.000 e passariam do limite (confira o valor atual com o contador).",
  },
  {
    id: "ordem-distribuicao",
    termo: "Ordem de distribuição",
    frase: "Quem recebe primeiro quando o cliente paga só uma parte ou atrasa.",
    exemplo: "Cliente pagou R$ 1.000 de R$ 2.000: \"custo primeiro\" paga as ferramentas antes e o resto vai para os sócios; \"proporcional\" divide os R$ 1.000 na mesma proporção de sempre.",
  },
  {
    id: "tempo-por-entrega",
    termo: "Tempo por entrega",
    frase: "Quanto tempo leva, em média, para fazer uma unidade de cada entrega. É daqui que saem as horas de cada cliente.",
    exemplo: "Post leva 20 min: 12 posts por mês são 4 h de trabalho.",
  },
  {
    id: "calibragem",
    termo: "Calibragem",
    frase: "Comparar o tempo cadastrado com o tempo medido, quando alguém usou o cronômetro (opcional) numa entrega que não sabia quanto levava.",
    exemplo: "O carrossel estava cadastrado com 40 min, mas as medições deram média de 55 min: o sistema sugere atualizar, e vocês decidem.",
  },
  {
    id: "entrada",
    termo: "Entrada do cliente",
    frase: "O trabalho que acontece uma vez só, no começo (organizar o perfil, identidade, primeiros posts). Fica separado da rotina do mês.",
    exemplo: "10 h de trabalho de entrada podem ser cobradas à parte ou diluídas nos primeiros meses.",
  },
  {
    id: "excecao",
    termo: "Exceção",
    frase: "Quando um escopo ou proposta fica abaixo do piso de um sócio, só vale se ele aprovar.",
    exemplo: "Um cliente estratégico que paga R$ 40/h quando o piso é R$ 50/h: o sócio afetado precisa dizer sim.",
  },
];

export const termo = (id: string) => GLOSSARIO.find((t) => t.id === id);

export interface PassoTour {
  titulo: string;
  texto: string;
}

/** Tour de primeira vez: a lógica geral em até 6 passos. */
export const TOUR: PassoTour[] = [
  {
    titulo: "Boas-vindas ao Aden",
    texto:
      "O Aden é a central da agência: tarefas, calendário, clientes, vendas, dinheiro e metas num lugar só, sem pular de programa em programa. Cada pessoa entra com o próprio acesso e vê o que é dela.",
  },
  {
    titulo: "Comece pela Visão do dia",
    texto:
      "Toda vez que abrir o Aden, você cai na Visão do dia: o que tem para resolver hoje, o que atrasou, o que depende de você e o que vem pela frente. Enquanto faltar configurar o básico, ela mostra por onde começar.",
  },
  {
    titulo: "Tarefas e calendário",
    texto:
      "Tudo o que está em produção vira tarefa, com responsável, prazo e checklist. Dentro de cada tarefa dá para medir o tempo, se quiser (opcional). O calendário mostra tudo no mês, para ninguém perder o fio da meada.",
  },
  {
    titulo: "Clientes e vendas",
    texto:
      "Em Leads fica quem se interessou; ao fechar, vira cliente com ficha e contrato. Em Vendas, a Calculadora mostra (só para os sócios) se o preço paga os custos e as horas de todo mundo, e a Proposta é a tela para mostrar os pacotes ao cliente e personalizar na hora.",
  },
  {
    titulo: "Dinheiro e mês",
    texto:
      "Cada pagamento que entra é registrado e dividido do jeito que vocês combinaram. A tela Mês junta as metas, cada cliente e o que cada sócio recebeu, em abas, e tem o botão dos Relatórios.",
  },
  {
    titulo: "Por onde começar",
    texto:
      "Preencha as Configurações (no fim do menu) e crie as primeiras tarefas. Em cada tela tem um botão \"?\", e o livrinho no rodapé abre o Glossário. O \"?\" do rodapé mostra este tour de novo.",
  },
];
