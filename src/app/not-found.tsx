import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex items-center gap-3 text-destructive">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
        <h1 className="text-3xl font-bold">Página no encontrada</h1>
      </div>
      <p className="max-w-xl text-lg text-muted-foreground">
        No pudimos encontrar la página que buscas. Revisa la URL o vuelve al panel para seguir
        gestionando la carrera.
      </p>
      <Button asChild size="lg">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
