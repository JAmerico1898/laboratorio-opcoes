import Link from "next/link";

const modules = [
  {
    n: "01",
    title: "Dados de Mercado",
    href: "/mercado",
    desc: "Carregar PETR4, VALE3 e outros via yfinance. Histórico, variações, gráfico.",
  },
  {
    n: "02",
    title: "Volatilidade",
    href: "/volatilidade",
    desc: "HV21 / HV63 / HV252, rolling vol, histograma de retornos. Escolha o σ que vai propagar para os outros módulos.",
  },
  {
    n: "03",
    title: "Black-Scholes",
    href: "/blackscholes",
    desc: "Preço teórico para call/put. Tabela por σ, payoff e calculadora interativa.",
  },
  {
    n: "04",
    title: "Gregas",
    href: "/gregas",
    desc: "Δ Γ θ ν ρ — cards explicativos, gráficos vs S, decaimento temporal e simulador 'E se...?'.",
  },
  {
    n: "05",
    title: "Comparação com o Mercado",
    href: "/comparacao",
    desc: "Vol implícita vs HV, smile de volatilidade, análise automática de divergência.",
  },
  {
    n: "06",
    title: "Tutorial",
    href: "/tutorial",
    desc: "Guia completo para quem nunca operou opções: do conceito ao passo a passo no aplicativo.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-5xl text-navy">Laboratório de Opções</h1>
      <div className="mt-3 h-px w-16 bg-gold" />
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary">
        Aplicativo interativo para explorar precificação Black-Scholes, gregas e
        volatilidade. Cinco módulos encadeados — do dado bruto à comparação com a
        cotação observada no home-broker.
      </p>

      <ul className="mt-12 grid gap-4">
        {modules.map((m) => (
          <li key={m.n}>
            <Link
              href={m.href}
              className="group flex items-start gap-6 rounded-lg border border-light-border bg-white p-6 transition hover:border-gold hover:shadow-sm"
            >
              <span className="font-mono text-sm text-gold">{m.n}</span>
              <div className="flex-1">
                <div
                  className="text-2xl text-navy group-hover:text-navy-light"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {m.title}
                </div>
                <p className="mt-1 text-sm text-text-secondary">{m.desc}</p>
              </div>
              <span className="self-center text-warm-gray transition group-hover:translate-x-1 group-hover:text-gold">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

    </div>
  );
}
