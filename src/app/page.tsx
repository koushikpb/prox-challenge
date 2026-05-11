import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-12">
      <h1 className="text-3xl font-semibold tracking-tight">Prox Challenge</h1>
      <p className="text-sm text-muted-foreground">Vulcan OmniPro 220 expert agent.</p>
      <Button>Get started</Button>
    </main>
  );
}
