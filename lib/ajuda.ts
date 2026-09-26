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
    titulo: "CRM",
    texto:
      "Cada pessoa interessada na Aden, da primeira mensagem até fechar. Anote cada conversa na ficha do lead e marque o próximo contato: ele aparece na sua Visão do dia. Quando fechar, um clique cria o cliente com a proposta combinada.",
    termos: ["lead", "escopo"],
  },
  "/clientes": {
    titulo: "Clientes e contratos",
    texto:
      "A ficha de cada cliente: contato, contrato, escopo, tarefas, pagamentos e a conversa de antes de fechar. Na aba Dados fica o link do painel do cliente, onde ele vê e aprova as peças. Preencha o dia do pagamento e as datas do contrato: o que vence aparece na sua Visão do dia.",
    termos: ["escopo", "rateio"],
  },
  "/calendario": {
    titulo: "Calendário",
    texto: "As tarefas no tempo, do início ao prazo, junto com os seus compromissos do Google Agenda. Clique num dia para ver o que tem nele ou criar uma tarefa ali. Dá para ver só as suas tarefas, as de outro sócio ou de todo mundo.",
  },
  "/calculadora": {
    titulo: "Calculadora de projeto",
    texto:
      "Serve para descobrir quanto cobrar de um cliente, ou o que cabe no valor que ele quer pagar. Use antes de mandar uma proposta: monte as entregas do mês e veja se a hora de cada sócio fica acima do piso. Clique no título de qualquer bloco para ver o que ele significa e o que já está cadastrado.",
    termos: ["escopo", "piso", "rateio", "sobra", "valor-por-hora"],
  },
  "/negociacao": {
    titulo: "Negociação ao vivo",
    texto:
      "É a calculadora com cara de apresentação, para mostrar ao cliente durante a conversa. Ele vê só o que pode ver: entregas e valor, nunca custos nem a divisão entre sócios. Use em reunião, ligando e desligando entregas até chegar num acordo.",
    termos: ["escopo"],
  },
  "/tarefas": {
    titulo: "Tarefas",
    texto:
      "Tudo o que está em produção, com o relógio dentro de cada tarefa. Ao começar a fazer uma entrega, abra a tarefa e aperte Start; ao terminar, marque como concluída. O tempo medido ensina o sistema quanto cada entrega leva de verdade.",
    termos: ["tempo-por-entrega", "calibragem"],
  },
  "/mes": {
    titulo: "Visão do mês",
    texto:
      "Mostra onde a Aden está na trilha de crescimento e quanto espaço ainda tem para vender. O primeiro número diz quantos clientes do pacote padrão ainda cabem com as horas livres de hoje. Use no começo do mês e antes de fechar um contrato.",
    termos: ["capacidade", "teto-mei"],
  },
  "/capacidade": {
    titulo: "Capacidade",
    texto: "O detalhe das horas: quanto cada cliente pede de cada sócio e quanto sobra para cada um no mês. Use para redistribuir o trabalho ou planejar a próxima contratação.",
    termos: ["capacidade", "tempo-por-entrega"],
  },
  "/calibragem": {
    titulo: "Calibragem das horas",
    texto:
      "Compara o tempo cadastrado de cada entrega com o tempo medido nas tarefas. Quando a média real fica diferente, o sistema sugere atualizar. Olhe de vez em quando, principalmente depois de medir as primeiras entregas de cada tipo.",
    termos: ["calibragem", "tempo-por-entrega"],
  },
  "/saude": {
    titulo: "Saúde dos clientes",
    texto:
      "Mostra, cliente por cliente, se o que foi combinado está pagando bem as horas de verdade. Quando um cliente está no prejuízo, aparecem os caminhos: subir o valor, cortar entregas ou os dois. Use no fim de cada mês.",
    termos: ["piso", "valor-por-hora", "escopo"],
  },
  "/pagamentos": {
    titulo: "Registrar pagamento",
    texto:
      "Anote aqui cada pagamento que cai, com o mês a que ele se refere. O sistema mostra quanto de cada pagamento vai para custos, empresa e cada sócio, e quem está atrasado. Use sempre que entrar dinheiro de cliente.",
    termos: ["ordem-distribuicao"],
  },
  "/repasse": {
    titulo: "Repasse dos sócios",
    texto:
      "Mostra quanto cada sócio já tem para receber no mês, com base nos pagamentos que entraram. Use na hora de fazer o repasse (a transferência para cada sócio).",
    termos: ["sobra", "reinvestimento", "ordem-distribuicao"],
  },
  "/pdfs": {
    titulo: "PDFs e relatórios",
    texto:
      "Gera os documentos para baixar: a proposta para o cliente, o resumo para o contador e o relatório de cada sócio. Cada um mostra só o que aquela pessoa pode ver.",
  },
  "/aprovacoes": {
    titulo: "Aprovações",
    texto:
      "Mudanças que mexem no bolso de um sócio (piso, percentual, divisão de horas, tempo por entrega) só valem depois que ele aprova. Aqui ficam os pedidos esperando resposta, e o histórico de tudo que foi decidido.",
    termos: ["piso", "excecao"],
  },
  "/avisos": {
    titulo: "Avisos",
    texto: "Recados do sistema para você: quem mudou o quê, e quanto isso muda no seu bolso por mês. Marque como lido depois de ver.",
  },
  "/configuracoes": {
    titulo: "Configurações",
    texto:
      "É a base de tudo: sócios, serviços, entregas, custos fixos, regras da empresa e clientes. Comece por aqui: sem esses números a calculadora não tem o que calcular. As abas com bolinha têm campo faltando.",
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
    frase: "Alguém que mostrou interesse na Aden mas ainda não fechou. Fica no CRM até virar cliente (ganho) ou desistir (perdido).",
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
    frase: "Medir o tempo real das primeiras entregas de cada tipo para descobrir se o tempo cadastrado está certo.",
    exemplo: "O carrossel estava cadastrado com 40 min, mas as 5 medições deram média de 55 min: o sistema sugere atualizar.",
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
      "O Aden é a central da agência: tarefas, calendário, comercial, financeiro e metas num lugar só, sem pular de programa em programa. Cada pessoa entra com o próprio acesso e vê o que é dela.",
  },
  {
    titulo: "Comece pela Visão do dia",
    texto:
      "Toda vez que abrir o Aden, você cai na Visão do dia: o que tem para resolver hoje, o que atrasou, o que depende de você (aprovações, avisos) e o que vem pela frente. Sócios podem olhar as pendências um do outro quando quiserem.",
  },
  {
    titulo: "Tarefas e calendário",
    texto:
      "Tudo o que está em produção vira tarefa, com responsável, prazo e checklist. Dentro de cada tarefa tem o Start para medir o tempo. O calendário mostra tudo no mês, para ninguém perder o fio da meada.",
  },
  {
    titulo: "Comercial",
    texto:
      "Na Negociação você apresenta os pacotes ao cliente e personaliza na hora. Por trás, a calculadora garante que o preço paga os custos e as horas de todo mundo. A Visão do dia mostra quantos clientes ainda cabem.",
  },
  {
    titulo: "Financeiro e metas",
    texto:
      "Cada pagamento que entra é registrado e dividido do jeito que vocês combinaram. A trilha de metas mostra onde a Aden está no crescimento e qual é o próximo passo.",
  },
  {
    titulo: "Por onde começar",
    texto:
      "Preencha as Configurações (sócios, entregas, pacotes, metas) e crie as primeiras tarefas. Em cada tela tem um botão \"?\" e o Glossário explica cada palavra. Dá para rever este tour pelo menu.",
  },
];
