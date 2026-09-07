import { Button } from '@asset-management/ui/components/ui/button';
import { Boxes, ScanLine, ShieldCheck } from 'lucide-react';

const capabilities = [
  { icon: Boxes, label: 'Asset registry' },
  { icon: ScanLine, label: 'Barcode & QR audit' },
  { icon: ShieldCheck, label: 'RBAC & audit trail' },
];

export function App() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-50">
      <section className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur md:p-14">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Centralized Asset Management
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Know every asset, owner, location, and audit event.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          React + Vite frontend พร้อมเชื่อมต่อ NestJS modular-monolith API
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {capabilities.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200">
              <Icon className="size-4 text-cyan-300" />
              {label}
            </div>
          ))}
        </div>
        <Button className="mt-10">Open workspace</Button>
      </section>
    </main>
  );
}

