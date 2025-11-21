"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Participant } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatElapsedTime } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";

export function LiveLeaderboard() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const isStandalone = searchParams?.get("standalone") === "1";

  useEffect(() => {
    const participantsRef = collection(db, "participants");
    const q = query(participantsRef, orderBy("finishTime"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: Participant[] = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Participant) }));
      setParticipants(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const standings = useMemo(() => {
    const finished = participants.filter((p) => !!p.finishTime && !!p.startTime);
    return finished.sort((a, b) => (a.finishTime! - a.startTime!) - (b.finishTime! - b.startTime!));
  }, [participants]);

  const running = useMemo(() => participants.filter((p) => !p.finishTime && p.startTime), [participants]);
  const queued = useMemo(() => participants.filter((p) => !p.startTime), [participants]);

  const openStandalone = () => {
    window.open("/live?standalone=1", "laptimer-live", "noopener,noreferrer,width=1200,height=800");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Clasificación en tiempo real</h2>
          <p className="text-sm text-muted-foreground">Actualiza en vivo desde Firestore sin refrescar la página.</p>
        </div>
        {!isStandalone && (
          <Button variant="outline" onClick={openStandalone}>
            <ExternalLink className="mr-2 h-4 w-4" /> Abrir en ventana separada
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Podio y posiciones</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Cargando posiciones...</p>
            ) : standings.length === 0 ? (
              <p className="text-muted-foreground">Aún no hay llegadas registradas.</p>
            ) : (
              <div className="space-y-3">
                {standings.map((p, index) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Badge variant={index < 3 ? "default" : "secondary"}>#{index + 1}</Badge>
                      <div>
                        <p className="font-semibold leading-tight">{p.bibNumber} - {p.name} {p.surname}</p>
                        <p className="text-xs text-muted-foreground">{p.distance} · {p.gender === 'Male' ? 'Masculino' : p.gender === 'Female' ? 'Femenino' : 'Otro'}</p>
                      </div>
                    </div>
                    <div className="font-mono text-lg">{formatElapsedTime((p.finishTime ?? 0) - (p.startTime ?? 0))}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>En carrera</CardTitle>
            </CardHeader>
            <CardContent>
              {running.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sin corredores en curso.</p>
              ) : (
                <div className="space-y-2">
                  {running.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="font-medium">{p.bibNumber} - {p.name} {p.surname}</p>
                        <p className="text-xs text-muted-foreground">{p.distance}</p>
                      </div>
                      <Badge variant="outline">En curso</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>En espera</CardTitle>
            </CardHeader>
            <CardContent>
              {queued.length === 0 ? (
                <p className="text-muted-foreground text-sm">Todos los corredores están en pista.</p>
              ) : (
                <div className="space-y-2">
                  {queued.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="font-medium">{p.bibNumber} - {p.name} {p.surname}</p>
                        <p className="text-xs text-muted-foreground">{p.distance}</p>
                      </div>
                      <Badge variant="secondary">Listo</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
