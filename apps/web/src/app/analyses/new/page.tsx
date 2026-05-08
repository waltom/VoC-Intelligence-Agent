import { AnalysisForm } from "./form";

export default function NewAnalysisPage() {
  return (
    <div className="container-narrow py-12">
      <p className="label-eyebrow mb-2">Nowa analiza</p>
      <h1 className="heading-1">Zbierz Voice of Customer</h1>
      <p className="mt-2 max-w-2xl text-zinc-600">
        Wybierz tryb. Auto pobiera publiczne opinie z internetu, a wklejanie pozwala
        wgrać własne dane (CSV, JSON albo zwykły tekst).
      </p>
      <div className="mt-8">
        <AnalysisForm />
      </div>
    </div>
  );
}
