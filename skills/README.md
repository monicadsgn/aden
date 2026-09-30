# Skills da Aden (Fase 6)

Skills para o Claude do claude.ai conduzir o comercial e o fechamento da Aden usando o conector do Aden
(código pessoal de cada sócio, Configurações → Equipe → Seu Claude). Cada pasta vira um arquivo `.skill`
(zip da pasta) para instalar em claude.ai → Configurações → Capacidades → Skills.

- `aden-rotina`: todo chat dos sócios: lê e anota as decisões da Aden, passa tarefa de um sócio para o outro e responde "o que eu tenho pra fazer?".
- `aden-proposta`: da conversa com o lead à proposta (pacote, calculadora, piso, mensagem).
- `aden-fechamento`: o cliente fechou → checklist inteiro (dados, contrato, onboarding, cobrança, pasta, briefing, kickoff, painel).
- `aden-contrato`: montar, conferir e enviar o contrato pela Autentique.
- `aden-onboarding`: gerar e mandar o onboarding.
- Apresentação comercial: espera o material de venda do Áleff.

Regras que valem para todas: nunca inventar número de negócio; tudo passa pelo conector (o Aden é a fonte);
o conector nunca aprova pedido; nada interno vai para o cliente (horas, piso, custo, divisão entre sócios).
Os arquivos `.skill` são o zip de cada pasta (a pasta vai dentro do zip). O teste `skills/skills.test.ts` confere que
cada skill só cita ferramentas que existem no conector e não cita outros sistemas.
