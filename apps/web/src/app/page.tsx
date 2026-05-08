import Link from "next/link";
import { ArrowRight, BarChart3, Bot, Database, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="container-narrow py-16 md:py-24">
      <section className="max-w-3xl">
        <p className="label-eyebrow mb-4">Voice of Customer Intelligence</p>
        <h1 className="heading-1 text-balance text-5xl leading-tight">
          Twoja firma w oczach klientów —{" "}
          <span className="text-zinc-500">w 3 minuty.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base text-zinc-600">
          Agent AI zbiera publiczne opinie z Trustpilot, Opineo i App Store, klasyfikuje
          sentyment i tematy, a następnie pisze raport biznesowy z konkretnymi action itemami
          popartymi cytatami z recenzji.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/analyses/new" className="button-primary h-10 px-5">
            Przeanalizuj swoją firmę <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/analyses?demo=1" className="button-secondary h-10 px-5">
            Zobacz przykład (demo)
          </Link>
        </div>
      </section>

      <section className="mt-20 grid gap-4 md:grid-cols-3">
        <Feature
          icon={<Bot className="h-5 w-5" />}
          title="Pętla agentic"
          desc="Plan → Collect → Classify → Reflect → Synthesize. Agent decyduje, czy ma wystarczająco danych, zanim napisze raport."
        />
        <Feature
          icon={<Database className="h-5 w-5" />}
          title="Mixed-model inference"
          desc="Workers AI (llama-3.1 + bge-m3) do klasyfikacji i embeddingów, Gemini Flash Lite do planowania i syntezy. Tańsze i szybsze."
        />
        <Feature
          icon={<BarChart3 className="h-5 w-5" />}
          title="Evidence-grounded"
          desc="Każdy action item ma cytaty zwalidowane substring matchem w bazie recenzji — żadnych halucynacji."
        />
      </section>

      <section className="mt-20 card p-8">
        <p className="label-eyebrow">Jak to działa</p>
        <ol className="mt-4 grid gap-6 md:grid-cols-5">
          {[
            "Wpisz nazwę firmy lub wklej recenzje",
            "Agent planuje, gdzie szukać",
            "Workers AI klasyfikuje sentyment",
            "Gemini robi refleksję i syntezę",
            "Otrzymujesz raport HTML",
          ].map((step, i) => (
            <li key={i} className="flex flex-col gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-medium text-white">
                {i + 1}
              </span>
              <span className="text-sm text-zinc-700">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 flex items-center gap-2 text-sm text-zinc-500">
        <Sparkles className="h-4 w-4" />
        Cały projekt mieści się w darmowych tierach Cloudflare i Google AI Studio.
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card p-6">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-zinc-900 text-white">
        {icon}
      </div>
      <h3 className="heading-2">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600">{desc}</p>
    </div>
  );
}
