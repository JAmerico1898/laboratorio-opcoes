"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type BoxVariant = "key" | "warn" | "practice";

function InfoBox({
  variant,
  title,
  children,
}: {
  variant: BoxVariant;
  title: string;
  children: ReactNode;
}) {
  const styles: Record<BoxVariant, { bg: string; border: string; icon: string; label: string }> = {
    key: {
      bg: "bg-[#eef3fb]",
      border: "border-[#1d4ed8]/30",
      icon: "💡",
      label: "Conceito-chave",
    },
    warn: {
      bg: "bg-[#fdf6e3]",
      border: "border-[#b8860b]/40",
      icon: "⚠️",
      label: "Atenção",
    },
    practice: {
      bg: "bg-[color:var(--b3-green-soft)]",
      border: "border-[#009b3a]/30",
      icon: "🎯",
      label: "Na prática",
    },
  };
  const s = styles[variant];
  return (
    <div className={cn("my-5 rounded-lg border p-4", s.bg, s.border)}>
      <div className="flex items-baseline gap-2">
        <span>{s.icon}</span>
        <div className="text-[10px] uppercase tracking-[0.18em] text-warm-gray">
          {s.label}
        </div>
      </div>
      <div className="mt-1 font-semibold text-navy">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-text-secondary">{children}</div>
    </div>
  );
}

function Tbl({
  head,
  rows,
}: {
  head: string[];
  rows: (ReactNode[])[];
}) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-light-border text-left text-[11px] uppercase tracking-wider text-text-muted">
            {head.map((h) => (
              <th key={h} className="py-2 pr-4">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-light-border/60 align-top">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-text-secondary">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-8 text-2xl text-navy" style={{ fontFamily: "var(--font-heading)" }}>
      {children}
    </h2>
  );
}
function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold text-navy">{children}</h3>
  );
}
function P({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-text-secondary">{children}</p>;
}
function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="my-4 border-l-2 border-gold pl-4 text-sm italic leading-relaxed text-text-secondary">
      {children}
    </blockquote>
  );
}
function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-md bg-navy/95 p-4 font-mono text-[12px] leading-relaxed text-cream">
      {children}
    </pre>
  );
}
function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="ml-5 mt-3 list-disc space-y-1 text-sm leading-relaxed text-text-secondary">
      {children}
    </ul>
  );
}
function OL({ children }: { children: ReactNode }) {
  return (
    <ol className="ml-5 mt-3 list-decimal space-y-1 text-sm leading-relaxed text-text-secondary">
      {children}
    </ol>
  );
}

type Chapter = {
  id: string;
  num: number;
  title: string;
  short: string;
  cta?: { href: string; label: string };
  content: ReactNode;
};

const CHAPTERS: Chapter[] = [
  {
    id: "cap0",
    num: 0,
    title: "O que é este aplicativo?",
    short: "Visão geral",
    content: (
      <>
        <P>
          Este aplicativo é uma <strong>calculadora educacional de opções financeiras</strong>.
          Ele foi criado para professores e estudantes que querem entender como o mercado
          precifica contratos de opções — e quanto essa precificação depende de premissas
          que nem sempre são óbvias.
        </P>
        <P>Com ele você vai conseguir:</P>
        <UL>
          <li>Buscar o preço atual de uma ação brasileira (por exemplo, PETR4 ou VALE3)</li>
          <li>Estimar a volatilidade dessa ação de diferentes formas</li>
          <li>Calcular o preço &quot;justo&quot; de uma opção usando o modelo Black-Scholes</li>
          <li>Comparar esse preço justo com o preço real que aparece no seu home-broker</li>
          <li>Entender como o preço da opção muda quando o mercado se move</li>
        </UL>
        <H3>O que o aplicativo NÃO faz</H3>
        <UL>
          <li>Não dá recomendações de compra ou venda</li>
          <li>Não acessa sua conta em corretora</li>
          <li>Não prevê o futuro do mercado</li>
        </UL>
        <InfoBox variant="warn" title="Aviso pedagógico">
          Todos os cálculos são para fins pedagógicos. Nenhuma informação deste aplicativo
          constitui recomendação de investimento.
        </InfoBox>
      </>
    ),
  },
  {
    id: "cap1",
    num: 1,
    title: "O que é uma opção financeira?",
    short: "Conceito de opção",
    content: (
      <>
        <H3>1.1 A intuição do cotidiano</H3>
        <P>
          Imagine que você quer comprar um apartamento, mas ainda não tem certeza.
          Você negocia com o vendedor o seguinte:
        </P>
        <Quote>
          &quot;Pago R$ 5.000 agora para ter o direito de comprar este apartamento por
          R$ 500.000 até o final do ano. Se eu desistir, perco os R$ 5.000. Se eu comprar,
          esses R$ 5.000 entram no pagamento.&quot;
        </Quote>
        <P>
          Isso é uma opção. Você pagou um <strong>prêmio</strong> (R$ 5.000) para ter um{" "}
          <strong>direito</strong> (comprar), sem ter uma <strong>obrigação</strong>{" "}
          (você pode desistir).
        </P>
        <P>No mercado financeiro funciona da mesma forma, mas o &quot;apartamento&quot; é uma ação.</P>

        <H3>1.2 Os dois tipos de opção</H3>
        <InfoBox variant="key" title="CALL — opção de compra">
          Dá ao comprador o direito de <strong>comprar</strong> a ação por um preço
          combinado. Útil quando você acredita que a ação vai <strong>subir</strong>.
          <br />
          Ex.: <em>&quot;Tenho o direito de comprar PETR4 por R$ 38,00 até 20 de junho.&quot;</em>
        </InfoBox>
        <InfoBox variant="key" title="PUT — opção de venda">
          Dá ao comprador o direito de <strong>vender</strong> a ação por um preço
          combinado. Útil quando você acredita que a ação vai <strong>cair</strong> ou
          quer se <strong>proteger</strong> de uma queda.
          <br />
          Ex.: <em>&quot;Tenho o direito de vender PETR4 por R$ 38,00 até 20 de junho.&quot;</em>
        </InfoBox>

        <H3>1.3 Os termos que você precisa conhecer</H3>
        <Tbl
          head={["Termo", "Significado", "Exemplo"]}
          rows={[
            [<strong key="a">Prêmio</strong>, "Preço pago pela opção", "R$ 2,15 por opção"],
            [<strong key="b">Strike (K)</strong>, "Preço combinado para exercer", "R$ 38,00"],
            [<strong key="c">Vencimento (T)</strong>, "Data limite para exercer", "20 de junho"],
            [<strong key="d">Ativo subjacente (S)</strong>, "A ação por trás da opção", "PETR4"],
            [<strong key="e">Exercício</strong>, "Usar o direito da opção", "Comprar ao preço K"],
          ]}
        />

        <H3>1.4 Quando vale a pena exercer?</H3>
        <P><strong>Para uma CALL:</strong></P>
        <UL>
          <li>Só vale exercer se o preço de mercado (S) for <strong>maior</strong> que K.</li>
          <li>S = R$ 42 e K = R$ 38 → você compra a 38 e a ação vale 42 → lucro de R$ 4.</li>
          <li>S = R$ 35 e K = R$ 38 → não exerce (mais barato comprar no mercado).</li>
        </UL>
        <P><strong>Para uma PUT:</strong></P>
        <UL>
          <li>Só vale exercer se S for <strong>menor</strong> que K.</li>
        </UL>

        <H3>1.5 Moneyness — onde a opção está em relação ao strike</H3>
        <Tbl
          head={["Situação", "Sigla", "Significado"]}
          rows={[
            ["S > K (call)", <strong key="a">ITM</strong>, "In the Money — opção tem valor intrínseco"],
            ["S = K", <strong key="b">ATM</strong>, "At the Money — no limiar"],
            ["S < K (call)", <strong key="c">OTM</strong>, "Out of the Money — só valor temporal"],
          ]}
        />
        <InfoBox variant="key" title="Valor intrínseco × valor temporal">
          <strong>Valor intrínseco</strong> é o quanto valeria exercer agora.
          <br />
          <strong>Valor temporal</strong> é o quanto o mercado paga pela{" "}
          <em>possibilidade</em> de a opção virar ITM antes do vencimento.
        </InfoBox>
      </>
    ),
  },
  {
    id: "cap2",
    num: 2,
    title: "De onde vem o preço de uma opção?",
    short: "Variáveis do prêmio",
    content: (
      <>
        <H3>2.1 O que determina o prêmio?</H3>
        <P>O preço de uma opção depende de 5 variáveis. Você vai ver todas elas no aplicativo:</P>
        <Tbl
          head={["Variável", "Símbolo", "Efeito no prêmio de uma CALL"]}
          rows={[
            ["Preço da ação", "S", "Sobe S → prêmio sobe"],
            ["Strike", "K", "Sobe K → prêmio cai"],
            ["Tempo até vencimento", "T", "Mais tempo → prêmio maior"],
            ["Taxa de juros", "r", "Sobe r → prêmio sobe levemente"],
            [<strong key="v">Volatilidade</strong>, <strong key="s">σ</strong>, <strong key="e">Sobe σ → prêmio sobe muito</strong>],
          ]}
        />

        <H3>2.2 Por que a volatilidade é tão importante?</H3>
        <P>Imagine duas ações:</P>
        <UL>
          <li><strong>Ação A:</strong> oscila ±1% por dia — previsível, calma.</li>
          <li><strong>Ação B:</strong> oscila ±5% por dia — imprevisível, agitada.</li>
        </UL>
        <P>
          Se você comprar uma call da Ação B, a chance de ela disparar para muito acima do
          strike é muito maior. Logo, o prêmio da Ação B vale mais.
        </P>
        <InfoBox variant="key" title="Volatilidade tem preço">
          Volatilidade é incerteza — e incerteza tem preço no mercado de opções.
        </InfoBox>

        <H3>2.3 O problema da volatilidade</H3>
        <P>
          As outras 4 variáveis (S, K, T, r) são observáveis diretamente. A volatilidade{" "}
          <strong>não</strong> — você nunca sabe qual será a volatilidade futura. Precisamos
          estimá-la.
        </P>
        <P>
          É exatamente isso que o <strong>Módulo 2 — Volatilidade</strong> do aplicativo resolve.
        </P>
      </>
    ),
    cta: { href: "/volatilidade", label: "Ir para Módulo 2 — Volatilidade" },
  },
  {
    id: "cap3",
    num: 3,
    title: "Volatilidade — o que é e por que importa",
    short: "Volatilidade",
    content: (
      <>
        <H3>3.1 Volatilidade histórica: o passado como guia</H3>
        <P>
          A forma mais direta de estimar volatilidade é medir o quanto a ação oscilou no
          passado recente.
        </P>
        <P><strong>Como se calcula:</strong></P>
        <OL>
          <li>Pegar os preços de fechamento dos últimos N dias.</li>
          <li>Calcular o retorno diário de cada dia (quanto subiu ou caiu vs. o dia anterior).</li>
          <li>Calcular o desvio padrão desses retornos.</li>
          <li>Multiplicar por √252 para anualizar (252 = dias úteis no Brasil).</li>
        </OL>
        <InfoBox variant="warn" title="Por que √252 e não √365?">
          Porque o mercado só opera em dias úteis. Finais de semana e feriados não contam
          para volatilidade.
        </InfoBox>

        <H3>3.2 Janelas de estimação: qual período usar?</H3>
        <Tbl
          head={["Janela", "Período", "Indica"]}
          rows={[
            ["HV 21d", "~1 mês", "Volatilidade muito recente — captura eventos frescos"],
            ["HV 63d", "~3 meses", "Volatilidade do trimestre — mais estável"],
            ["HV 252d", "~1 ano", "Referência histórica de longo prazo"],
          ]}
        />
        <InfoBox variant="practice" title="Qual usar para precificar?">
          Como regra geral, use a janela mais próxima do prazo da opção. Para uma opção que
          vence em 30 dias, prefira HV 21d ou HV 63d.
        </InfoBox>

        <H3>3.3 Clusters de volatilidade</H3>
        <P>
          Se você olhar o gráfico de volatilidade ao longo do tempo, vai perceber que ela{" "}
          <strong>não é constante</strong>: há períodos de calmaria e períodos de
          tempestade. Isso se chama <strong>clustering de volatilidade</strong>.
        </P>
        <Quote>
          &quot;Grande movimento hoje → grande movimento amanhã (não necessariamente na mesma
          direção).&quot;
        </Quote>
        <P>
          Isso é um problema para a HV simples, que trata todos os dias como igualmente
          relevantes.
        </P>

        <H3>3.4 GARCH: peso maior ao passado recente</H3>
        <P>
          O modelo <strong>GARCH</strong> (disponível no aplicativo como opção avançada)
          resolve esse problema dando <strong>mais peso aos dias recentes</strong> ao
          calcular a volatilidade esperada. É mais sofisticado e mais usado em bancos e
          gestoras.
        </P>

        <H3>3.5 Volatilidade implícita: o que o mercado está dizendo</H3>
        <P>
          Existe uma quarta estimativa que não usa histórico nenhum: a{" "}
          <strong>volatilidade implícita (IV)</strong>. Funciona ao contrário de tudo:
        </P>
        <UL>
          <li>Em vez de calcular o preço da opção a partir da volatilidade…</li>
          <li>…você observa o preço de mercado da opção e pergunta: <em>&quot;Qual volatilidade o mercado está assumindo?&quot;</em></li>
        </UL>
        <InfoBox variant="key" title="IV é o consenso do mercado">
          A IV é o consenso do mercado sobre incerteza futura — é mais valiosa que qualquer
          estimativa histórica, mas só está disponível se você tiver o preço de mercado da opção.
          O <strong>Módulo 5 — Comparação</strong> calcula a IV automaticamente.
        </InfoBox>
      </>
    ),
    cta: { href: "/volatilidade", label: "Explorar volatilidade →" },
  },
  {
    id: "cap4",
    num: 4,
    title: "Como funciona o modelo Black-Scholes",
    short: "Black-Scholes",
    content: (
      <>
        <H3>4.1 A ideia central</H3>
        <P>
          Em 1973, Fischer Black e Myron Scholes (com contribuição de Robert Merton)
          publicaram uma fórmula que responde:
        </P>
        <Quote>
          &quot;Dado o preço atual da ação, o strike, o prazo, os juros e a volatilidade —
          qual é o preço justo de uma opção?&quot;
        </Quote>
        <P>
          A intuição é elegante: se você puder ajustar continuamente uma carteira de ações
          para replicar exatamente o payoff da opção, o custo dessa carteira deve ser igual
          ao prêmio da opção. Caso contrário, haveria arbitragem.
        </P>

        <H3>4.2 As premissas do modelo (e suas limitações)</H3>
        <Tbl
          head={["Premissa", "Significa", "Limitação real"]}
          rows={[
            ["Volatilidade constante", "σ não muda no tempo", "Na prática muda todo dia"],
            ["Retornos normais", "Distribuição log-normal da ação", "Mercados têm caudas gordas — crashes são mais frequentes"],
            ["Mercado contínuo", "Comprar/vender a qualquer instante", "Há gaps de pregão e falta de liquidez"],
            ["Sem dividendos", "Sem proventos no período", "Versões ajustadas existem (Black-Scholes-Merton)"],
          ]}
        />
        <InfoBox variant="warn" title="B&S é referência, não verdade">
          O modelo não é perfeito — mas é o ponto de referência universal do mercado. Toda
          discussão de preço de opção começa nele.
        </InfoBox>

        <H3>4.3 Os inputs que o aplicativo pede</H3>
        <P>
          Quando você abre o <strong>Módulo 3 — Precificação</strong>, o aplicativo já
          preenche automaticamente:
        </P>
        <UL>
          <li><strong>S</strong> — preço atual da ação (vem do Módulo 1)</li>
          <li><strong>r</strong> — taxa Selic atual (carregada do Banco Central)</li>
          <li><strong>σ</strong> — a estimativa de volatilidade que você escolheu no Módulo 2</li>
        </UL>
        <P>Você precisa informar:</P>
        <UL>
          <li><strong>K</strong> — o strike da opção que você quer precificar</li>
          <li><strong>T</strong> — a data de vencimento (ou os dias úteis restantes)</li>
          <li><strong>Tipo</strong> — call ou put</li>
        </UL>

        <H3>4.4 O que são d1, d2 e N(d2)?</H3>
        <P>
          O aplicativo exibe esses números na tabela. Você não precisa decorar a fórmula —
          mas entender o significado ajuda:
        </P>
        <UL>
          <li><strong>d1 e d2</strong> são valores intermediários: representam a &quot;distância padronizada&quot; entre S e K, ajustada pelo tempo e pela volatilidade.</li>
          <li><strong>N(d2)</strong> é a <strong>probabilidade (sob medida risk-neutral) de a opção ser exercida</strong> no vencimento — para uma call, a chance de S terminar acima de K.</li>
        </UL>
        <Quote>
          Se N(d2) = 0,58 → o modelo estima 58% de chance de a call ser exercida.
        </Quote>

        <H3>4.5 Valor intrínseco × valor temporal</H3>
        <Code>
{`Prêmio = Valor Intrínseco + Valor Temporal

Valor Intrínseco = max(S − K, 0)        [call exercida agora]
Valor Temporal   = Prêmio − Intrínseco  [pago pela espera]`}
        </Code>
        <P>
          Uma opção OTM tem valor intrínseco zero — é puro valor temporal. Conforme o
          vencimento se aproxima, o valor temporal vai a zero. Esse decaimento é o{" "}
          <strong>Theta</strong>.
        </P>
      </>
    ),
    cta: { href: "/blackscholes", label: "Ir para Módulo 3 — Black-Scholes" },
  },
  {
    id: "cap5",
    num: 5,
    title: "O que são as Gregas?",
    short: "Gregas",
    content: (
      <>
        <P>
          As gregas medem <strong>como o prêmio reage</strong> a mudanças em cada variável.
          São chamadas de gregas porque usam letras do alfabeto grego.
        </P>

        <H3>5.1 Delta (Δ) — sensibilidade ao preço da ação</H3>
        <P><em>&quot;Se a ação subir R$ 1,00, quanto muda o prêmio?&quot;</em></P>
        <UL>
          <li>Delta de uma call: entre 0 e 1.</li>
          <li>Delta de uma put: entre −1 e 0.</li>
          <li>ATM (S ≈ K): Delta ≈ 0,50 para call.</li>
          <li>Deep ITM: Delta → 1,00 (a opção quase replica a ação).</li>
          <li>Deep OTM: Delta → 0,00 (a opção mal reage).</li>
        </UL>
        <InfoBox variant="practice" title="Delta Hedge">
          Se você comprou 1.000 calls com Δ = 0,50, sua exposição equivale a 500 ações.
          Para ficar neutro ao movimento da ação, vende 500 ações.
        </InfoBox>
        <Quote>Delta ≈ probabilidade de exercício (aproximação útil, não exata).</Quote>

        <H3>5.2 Gamma (Γ) — a velocidade do Delta</H3>
        <P><em>&quot;Quando a ação se move, como o Delta muda?&quot;</em></P>
        <UL>
          <li>Sempre positivo para o comprador de opção.</li>
          <li>Máximo quando a opção está ATM.</li>
          <li>Gamma alto = Delta muda rápido = hedge precisa ser refeito com frequência.</li>
        </UL>
        <Quote>Se Delta é a velocidade, Gamma é a aceleração.</Quote>
        <InfoBox variant="warn" title="Quem vendeu opção tem Gamma negativo">
          O vendedor pode ser surpreendido por movimentos grandes do mercado.
        </InfoBox>

        <H3>5.3 Theta (θ) — decaimento temporal</H3>
        <P><em>&quot;Por dia que passa sem movimento, quanto o prêmio perde?&quot;</em></P>
        <UL>
          <li>Sempre negativo para o <strong>comprador</strong> (o tempo corre contra).</li>
          <li>Sempre positivo para o <strong>vendedor</strong> (o tempo corre a favor).</li>
          <li>O decaimento <strong>acelera</strong> conforme o vencimento se aproxima.</li>
        </UL>
        <Quote>Uma fruta que apodrece mais rápido nos últimos dias.</Quote>

        <H3>5.4 Vega (ν) — sensibilidade à volatilidade</H3>
        <P><em>&quot;Se a volatilidade subir 1 ponto percentual, quanto muda o prêmio?&quot;</em></P>
        <UL>
          <li>Sempre positivo para o comprador.</li>
          <li>Máximo em ATM e com muito tempo até o vencimento.</li>
          <li>Cai a zero no vencimento (não importa mais qual a vol).</li>
        </UL>
        <InfoBox variant="key" title="O trade-off do comprador de opção">
          Theta negativo: perde por dia que passa.
          <br />
          Vega positivo: ganha se a volatilidade subir.
          <br />
          O comprador está apostando que a <strong>volatilidade realizada</strong> será
          maior que a <strong>implícita</strong>.
        </InfoBox>

        <H3>5.5 Rho (ρ) — sensibilidade à taxa de juros</H3>
        <P><em>&quot;Se a Selic subir 1%, quanto muda o prêmio?&quot;</em></P>
        <UL>
          <li>Calls: Rho positivo. Puts: Rho negativo.</li>
          <li>Para opções de curto prazo, o efeito é pequeno.</li>
          <li>Para opções longas (LEAPS), pode ser relevante.</li>
        </UL>
        <Quote>
          Em opções de curto prazo no Brasil, Rho é a menos importante das gregas.
        </Quote>

        <H3>5.6 O simulador &quot;E se…?&quot; do Módulo 4</H3>
        <P>
          O aplicativo decompõe a variação estimada do prêmio em contribuições de cada grega.
          Por exemplo, &quot;PETR4 sobe 5% amanhã e a vol cai 2 p.p.&quot;:
        </P>
        <Code>
{`Contribuição do Delta:  +R$ 1,12
Contribuição do Gamma:  +R$ 0,08
Contribuição do Theta:  −R$ 0,14   (um dia passa)
Contribuição do Vega:   −R$ 0,41   (vol caiu 2 p.p.)
──────────────────────────────────────────────
Total aproximado:        +R$ 0,65
B&S recalculado:         +R$ 0,68`}
        </Code>
        <P>
          A pequena diferença vem de <strong>efeitos de segunda ordem</strong> — interações
          entre as gregas que a aproximação linear não captura.
        </P>
      </>
    ),
    cta: { href: "/gregas", label: "Ir para Módulo 4 — Gregas" },
  },
  {
    id: "cap6",
    num: 6,
    title: "Como usar o aplicativo passo a passo",
    short: "Passo a passo",
    content: (
      <>
        <H3>Passo 1 — Carregar dados da ação (Módulo 1)</H3>
        <OL>
          <li>Acesse <strong>Dados de Mercado</strong> no menu lateral.</li>
          <li>Digite o código da ação no campo <strong>Ticker</strong>: <code>PETR4</code>, <code>VALE3</code>, etc.</li>
          <li>Clique em <strong>Carregar</strong>.</li>
          <li>Aguarde os dados aparecerem nos cards e no gráfico histórico.</li>
          <li>Os dados ficam salvos automaticamente para os próximos módulos.</li>
        </OL>
        <InfoBox variant="practice" title="Plano B — CSV">
          Se o carregamento falhar (instabilidade de rede), faça upload de um CSV com colunas{" "}
          <code>date</code> e <code>close</code>.
        </InfoBox>

        <H3>Passo 2 — Estimar a volatilidade (Módulo 2)</H3>
        <OL>
          <li>Acesse <strong>Volatilidade</strong>.</li>
          <li>Selecione a <strong>data de vencimento</strong> da opção. O app converte
              automaticamente em dias úteis (B3) e usa esse prazo nos demais módulos.</li>
          <li>HV21, HV63, HV252, GARCH(1,1) e <strong>HV prazo</strong> (janela exata até
              o vencimento) já aparecem calculadas.</li>
          <li>Veja o gráfico de <em>rolling volatility</em> — como σ varia no tempo.</li>
          <li>Veja o histograma de retornos — caudas vs. distribuição normal.</li>
          <li>Clique no botão da estimativa que vai usar — ela é propagada para
              B&amp;S, Gregas e Comparação.</li>
        </OL>
        <InfoBox variant="warn" title="Não há estimativa certa">
          A escolha da janela é uma decisão de julgamento. Essa ambiguidade é
          justamente o que o Módulo 5 ajuda a investigar.
        </InfoBox>

        <H3>Passo 3 — Calcular o preço teórico (Módulo 3)</H3>
        <OL>
          <li>Acesse <strong>Black-Scholes</strong>.</li>
          <li>S, r, σ e o prazo (T em dias úteis, derivado da data de vencimento) já
              vêm preenchidos dos módulos anteriores.</li>
          <li>Preencha K (strike) e escolha o tipo (call/put).</li>
          <li>Observe a <strong>tabela de preços</strong> — uma linha por σ.</li>
          <li>Mexa nos <strong>sliders</strong> para sentir o efeito de cada variável.</li>
        </OL>
        <InfoBox variant="practice" title="Onde achar strike e vencimento">
          No home-broker, abra a aba de Opções da ação. Anote o código (ex.: PETRG28),
          o prêmio, o strike e a data de vencimento. Lembre-se: opções de ações vencem na{" "}
          <strong>terceira segunda-feira</strong> de cada mês.
        </InfoBox>

        <H3>Passo 4 — Explorar as Gregas (Módulo 4)</H3>
        <OL>
          <li>Acesse <strong>Gregas</strong>.</li>
          <li>As gregas já vêm calculadas para os inputs do Módulo 3.</li>
          <li>Leia os cards: cada um traduz a grega para linguagem concreta.</li>
          <li>Observe os gráficos — como cada grega muda com S.</li>
          <li>Use o simulador <strong>&quot;E se…?&quot;</strong> e a calculadora de <strong>Delta Hedge</strong>.</li>
        </OL>
        <InfoBox variant="practice" title="Foco didático">
          O gráfico de decaimento temporal (Theta) é o mais didático para a primeira aula.
          Mostre como as 3 curvas (hoje / T/2 / T/10) divergem perto do vencimento.
        </InfoBox>

        <H3>Passo 5 — Comparar com o mercado (Módulo 5)</H3>
        <OL>
          <li>Acesse <strong>Comparação com Mercado</strong>.</li>
          <li>Digite o código da opção (ex.: <code>PETRG28</code>) e clique em <strong>Parse</strong>.</li>
          <li>Confirme strike e tipo extraídos.</li>
          <li>Digite o <strong>prêmio observado</strong> (último negócio ou meio do spread).</li>
          <li>Veja a tabela: diferenças entre teórico (cada σ) e mercado.</li>
          <li>A última linha é a <strong>Volatilidade Implícita</strong>.</li>
          <li>Use o gauge para comparar a IV com o σ que você escolheu no Módulo 2
              (a zona verde fica ao redor desse σ ± 5 p.p.); explore o smile
              inserindo outros strikes.</li>
        </OL>
        <InfoBox variant="key" title="O que fazer com a diferença?">
          Uma diferença grande entre B&amp;S e mercado <strong>não significa que um está
          errado</strong>. Significa que o mercado está assumindo uma volatilidade diferente
          da histórica — e isso merece investigação.
        </InfoBox>

        <H2>Perguntas frequentes</H2>
        <H3>O aplicativo precisa de conta em corretora?</H3>
        <P>Não. Você apenas digita manualmente o preço que vê no home-broker.</P>
        <H3>Os preços das ações são em tempo real?</H3>
        <P>
          Pequeno atraso (Yahoo Finance, dados do final do pregão anterior). Para fins
          pedagógicos é suficiente.
        </P>
        <H3>Posso usar para qualquer ação brasileira?</H3>
        <P>
          Sim, qualquer ação da B3 com sufixo <code>.SA</code> no Yahoo Finance. Ações muito
          ilíquidas podem ter dados incompletos.
        </P>
        <H3>Dias úteis vs. dias corridos?</H3>
        <P>
          Opções usam dias úteis. Um mês ≈ 21 d.u., um trimestre ≈ 63, um ano = 252. O
          aplicativo faz a conversão automaticamente.
        </P>
        <H3>GARCH não aparece — o que houve?</H3>
        <P>
          O GARCH depende de um serviço externo. Se não aparecer, use HV — são igualmente
          válidas para fins pedagógicos.
        </P>
        <H3>A volatilidade implícita não convergiu — o que significa?</H3>
        <P>
          Pode acontecer com opções deep OTM (bid próximo de zero) ou inputs inconsistentes.
          Verifique K, T e o tipo (call/put).
        </P>
        <H3>Por que o preço teórico difere do home-broker?</H3>
        <P>
          Essa é a pergunta pedagógica central. As principais razões: (1) σ histórico não
          reflete expectativa futura; (2) B&amp;S tem premissas simplificadoras; (3) há
          spread bid-ask. O Módulo 5 ajuda a decompor a diferença.
        </P>

        <H2>Glossário rápido</H2>
        <Tbl
          head={["Termo", "Definição"]}
          rows={[
            ["ATM", "At the Money — strike próximo do preço atual"],
            ["B&S", "Black-Scholes — modelo de precificação de opções"],
            ["Call", "Opção de compra"],
            ["Delta", "Variação do prêmio por R$ 1 de variação em S"],
            ["Gamma", "Variação do Delta por R$ 1 de variação em S"],
            ["HV", "Historical Volatility — volatilidade do histórico"],
            ["ITM", "In the Money — opção com valor intrínseco positivo"],
            ["IV", "Implied Volatility — vol implícita no preço de mercado"],
            ["K", "Strike — preço de exercício"],
            ["OTM", "Out of the Money — sem valor intrínseco"],
            ["Prêmio", "Preço pago pela opção"],
            ["Put", "Opção de venda"],
            ["Rho", "Variação do prêmio por 1% de variação em r"],
            ["S", "Preço atual do ativo subjacente"],
            ["Selic", "Taxa básica de juros — taxa livre de risco no Brasil"],
            ["T", "Tempo até o vencimento (fração de ano)"],
            ["Theta", "Variação do prêmio por dia que passa"],
            ["Valor Intrínseco", "Quanto valeria exercer agora"],
            ["Valor Temporal", "Parte do prêmio pela possibilidade futura"],
            ["Vega", "Variação do prêmio por 1 p.p. em σ"],
            ["Volatilidade", "Dispersão dos retornos — quanto a ação oscila"],
            ["σ (sigma)", "Símbolo da volatilidade"],
          ]}
        />
      </>
    ),
    cta: { href: "/comparacao", label: "Ir para Módulo 5 — Comparação" },
  },
];

export default function TutorialPage() {
  const [active, setActive] = useState(0);
  const chapter = CHAPTERS[active];
  const total = CHAPTERS.length;
  const prev = active > 0 ? CHAPTERS[active - 1] : null;
  const next = active < total - 1 ? CHAPTERS[active + 1] : null;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="text-[11px] uppercase tracking-[0.25em] text-warm-gray">Módulo 06</div>
      <h1 className="mt-3 text-4xl text-navy">Tutorial</h1>
      <div className="mt-3 h-px w-12 bg-gold" />
      <p className="mt-4 max-w-3xl text-sm text-text-secondary">
        Guia para quem nunca operou opções. Cada capítulo começa pela intuição do cotidiano
        e só então apresenta o conceito formal. Fórmulas aparecem como consequência da
        intuição, nunca como ponto de partida.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Índice */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="text-[10px] uppercase tracking-[0.18em] text-warm-gray">Índice</div>
          <nav className="mt-3 space-y-1">
            {CHAPTERS.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setActive(i)}
                className={cn(
                  "flex w-full items-baseline gap-3 rounded-md px-3 py-2 text-left text-sm transition",
                  i === active
                    ? "bg-navy text-cream"
                    : "text-text-secondary hover:bg-cream hover:text-navy"
                )}
              >
                <span
                  className={cn(
                    "w-6 font-mono text-[10px] tabular-nums",
                    i === active ? "text-gold-light" : "text-text-muted"
                  )}
                >
                  Cap {c.num}
                </span>
                <span className="leading-snug">{c.short}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Conteúdo */}
        <div>
          {/* Top nav */}
          <div className="flex items-center justify-between rounded-lg border border-light-border bg-white p-3 text-xs">
            <button
              onClick={() => prev && setActive(active - 1)}
              disabled={!prev}
              className={cn(
                "rounded-md px-3 py-1.5 uppercase tracking-wider",
                prev ? "text-navy hover:bg-cream" : "text-text-muted/50"
              )}
            >
              ← {prev ? prev.short : "início"}
            </button>
            <div className="font-mono text-text-muted">
              Cap. {chapter.num} de {total - 1}
            </div>
            <button
              onClick={() => next && setActive(active + 1)}
              disabled={!next}
              className={cn(
                "rounded-md px-3 py-1.5 uppercase tracking-wider",
                next ? "text-navy hover:bg-cream" : "text-text-muted/50"
              )}
            >
              {next ? next.short : "fim"} →
            </button>
          </div>

          {/* Capítulo */}
          <article className="mt-6 rounded-lg border border-light-border bg-white px-8 py-8 shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gold">
              Capítulo {chapter.num}
            </div>
            <h2
              className="mt-2 text-3xl text-navy"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {chapter.title}
            </h2>
            <div className="mt-3 h-px w-10 bg-gold" />
            <div className="mt-6">{chapter.content}</div>

            {/* CTA do capítulo */}
            {chapter.cta && (
              <div className="mt-10 flex justify-end">
                <Link
                  href={chapter.cta.href}
                  className="inline-flex items-center gap-2 rounded-md bg-navy px-5 py-2.5 text-xs uppercase tracking-wider text-cream hover:bg-navy-light"
                >
                  {chapter.cta.label}
                </Link>
              </div>
            )}
          </article>

          {/* Bottom nav */}
          <div className="mt-6 flex items-center justify-between text-xs">
            <button
              onClick={() => prev && setActive(active - 1)}
              disabled={!prev}
              className={cn(
                "rounded-md border px-4 py-2 uppercase tracking-wider",
                prev
                  ? "border-light-border text-navy hover:border-gold hover:text-gold"
                  : "border-light-border/40 text-text-muted/40"
              )}
            >
              ← Capítulo anterior
            </button>
            <button
              onClick={() => next && setActive(active + 1)}
              disabled={!next}
              className={cn(
                "rounded-md border px-4 py-2 uppercase tracking-wider",
                next
                  ? "border-light-border text-navy hover:border-gold hover:text-gold"
                  : "border-light-border/40 text-text-muted/40"
              )}
            >
              Próximo capítulo →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
