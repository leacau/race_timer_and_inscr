"use client";

import React, { useMemo, useState, useContext, useEffect } from "react";
import type { Participant, Category } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AppContext } from "@/context/app-context";
import { formatElapsedTime } from "@/lib/utils";
import { startTimingGroup, TimingMode, updateParticipantTime } from "@/lib/actions";
import { cn } from "@/lib/utils";

const distanceOrder: Record<Participant["distance"], number> = { "5k": 1, "10k": 2, "21k": 3, "42k": 4 };

type TimingGroup = {
  key: string;
  label: string;
  participantCount: number;
  finishedCount: number;
  startTime: number | null;
  actionGroupId: string | null;
};

const modeOptions: { value: TimingMode; label: string }[] = [
  { value: "general", label: "Largada única" },
  { value: "distance", label: "Por distancia" },
  { value: "category", label: "Por categoría" },
];

const emptyTime = "00:00:00.00";

export function TimingDashboard({
  participants,
  categories,
}: {
  participants: Participant[];
  categories: Category[];
}) {
  const { toast } = useToast();
  const { role } = useContext(AppContext);
  const isAdmin = role === "admin";
  const [mode, setMode] = useState<TimingMode>("general");
  const [startingGroupKey, setStartingGroupKey] = useState<string | null>(null);
  const [manualBib, setManualBib] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const categoriesMap = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = category.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  const getGroupStart = (groupParticipants: Participant[]) => {
    const startTimes = groupParticipants.map((p) => p.startTime).filter(Boolean) as number[];
    if (startTimes.length === 0) return null;
    return Math.min(...startTimes);
  };

  const groups = useMemo<TimingGroup[]>(() => {
    if (participants.length === 0) return [];

    if (mode === "general") {
      return [
        {
          key: "general",
          label: "Cronómetro general",
          participantCount: participants.length,
          finishedCount: participants.filter((p) => p.finishTime).length,
          startTime: getGroupStart(participants),
          actionGroupId: null,
        },
      ];
    }

    if (mode === "distance") {
      const map = new Map<string, Participant[]>();
      participants.forEach((participant) => {
        const current = map.get(participant.distance) ?? [];
        current.push(participant);
        map.set(participant.distance, current);
      });

      return Array.from(map.entries())
        .sort((a, b) => distanceOrder[a[0] as Participant["distance"]] - distanceOrder[b[0] as Participant["distance"]])
        .map(([distance, members]) => ({
          key: `distance:${distance}`,
          label: `Distancia ${distance}`,
          participantCount: members.length,
          finishedCount: members.filter((p) => p.finishTime).length,
          startTime: getGroupStart(members),
          actionGroupId: distance,
        }));
    }

    const map = new Map<string, { label: string; members: Participant[]; actionGroupId: string | null }>();
    participants.forEach((participant) => {
      const categoryId = participant.categoryId ?? "__sin_categoria__";
      const label = participant.categoryId ? categoriesMap[participant.categoryId] ?? "Sin categoría" : "Sin categoría";
      if (!map.has(categoryId)) {
        map.set(categoryId, { label, members: [], actionGroupId: participant.categoryId ?? null });
      }
      map.get(categoryId)!.members.push(participant);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([key, value]) => ({
        key: `category:${key}`,
        label: value.label,
        participantCount: value.members.length,
        finishedCount: value.members.filter((p) => p.finishTime).length,
        startTime: getGroupStart(value.members),
        actionGroupId: value.actionGroupId,
      }));
  }, [mode, participants, categoriesMap]);

  const startTimeLookup = useMemo(() => {
    const lookup: Record<string, number | null> = {};
    groups.forEach((group) => {
      lookup[group.key] = group.startTime;
    });
    return lookup;
  }, [groups]);

  const finishers = useMemo(() => {
    return participants
      .filter((participant) => participant.finishTime && participant.startTime)
      .sort((a, b) => (a.finishTime! - b.finishTime!));
  }, [participants]);

  const categoryArrivals = useMemo(() => {
    const map = new Map<string, { label: string; members: Participant[] }>();
    finishers.forEach((participant) => {
      const categoryId = participant.categoryId ?? "__sin_categoria__";
      const label = participant.categoryId ? categoriesMap[participant.categoryId] ?? "Sin categoría" : "Sin categoría";
      if (!map.has(categoryId)) {
        map.set(categoryId, { label, members: [] });
      }
      map.get(categoryId)!.members.push(participant);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([key, value]) => ({ key, ...value }));
  }, [finishers, categoriesMap]);

  const getGroupKeyForParticipant = (participant: Participant, currentMode: TimingMode) => {
    if (currentMode === "general") return "general";
    if (currentMode === "distance") return `distance:${participant.distance}`;
    const categoryId = participant.categoryId ?? "__sin_categoria__";
    return `category:${categoryId}`;
  };

  const handleStartGroup = async (group: TimingGroup) => {
    if (!isAdmin) return;
    if (group.startTime && !window.confirm("Ya existe un inicio registrado. ¿Deseas reiniciar este cronómetro?")) {
      return;
    }
    setStartingGroupKey(group.key);
    try {
      await startTimingGroup(mode, group.actionGroupId);
      toast({
        title: "Cronómetro iniciado",
        description: `Se inició la largada para ${group.label}.`,
      });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo iniciar el cronómetro seleccionado." });
    } finally {
      setStartingGroupKey(null);
    }
  };

  const handleManualCapture = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualBib.trim()) return;
    const bib = manualBib.trim();
    const participant = participants.find((p) => p.bibNumber === bib);
    if (!participant) {
      toast({ variant: "destructive", title: "Dorsal no encontrado", description: `No existe el dorsal ${bib}.` });
      return;
    }

    const groupKey = getGroupKeyForParticipant(participant, mode);
    const startTime = startTimeLookup[groupKey];
    if (!startTime) {
      toast({
        variant: "destructive",
        title: "Cronómetro no iniciado",
        description: "Inicia el cronómetro correspondiente antes de registrar llegadas.",
      });
      return;
    }

    setIsSavingManual(true);
    try {
      const finishTime = Date.now();
      await updateParticipantTime(participant.id, startTime, finishTime);
      toast({
        title: "Tiempo registrado",
        description: `Se registró la llegada del dorsal ${bib}.`,
      });
      setManualBib("");
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el tiempo." });
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Modo de largada</CardTitle>
          <CardDescription>Elige cómo quieres administrar los cronómetros de la carrera.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mode} onValueChange={(value) => setMode(value as TimingMode)} className="grid gap-4 md:grid-cols-3">
            {modeOptions.map((option) => (
              <Label
                key={option.value}
                htmlFor={`mode-${option.value}`}
                className={cn(
                  "flex cursor-pointer flex-col gap-2 rounded-md border p-4",
                  mode === option.value ? "border-primary" : "border-muted"
                )}
              >
                <RadioGroupItem value={option.value} id={`mode-${option.value}`} className="sr-only" />
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-sm text-muted-foreground">
                  {option.value === "general" && "Un único disparo de largada para todos los participantes."}
                  {option.value === "distance" && "Cada distancia tiene su propio cronómetro."}
                  {option.value === "category" && "Cada categoría larga de manera independiente."}
                </span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.length === 0 && (
          <div className="col-span-full text-center text-sm text-muted-foreground">
            Aún no hay participantes para cronometrar.
          </div>
        )}
        {groups.map((group) => (
          <Card key={group.key}>
            <CardHeader>
              <CardTitle className="text-base">{group.label}</CardTitle>
              <CardDescription>
                {group.participantCount} participantes · {group.finishedCount} llegados
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Cronómetro</p>
                <p className="font-mono text-3xl">
                  {group.startTime ? formatElapsedTime(now - group.startTime) : emptyTime}
                </p>
              </div>
              {isAdmin && (
                <Button
                  onClick={() => handleStartGroup(group)}
                  disabled={startingGroupKey === group.key}
                  variant={group.startTime ? "outline" : "default"}
                >
                  {group.startTime ? "Reiniciar" : "Iniciar"}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Registro manual de llegadas</CardTitle>
            <CardDescription>Ingresa el número de dorsal para guardar el tiempo actual según el modo elegido.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualCapture} className="flex flex-col gap-4 md:flex-row">
              <div className="flex-1 space-y-2">
                <Label htmlFor="manual-bib">Número de dorsal</Label>
                <Input id="manual-bib" value={manualBib} onChange={(event) => setManualBib(event.target.value)} placeholder="Ej: 152" />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={isSavingManual} className="w-full md:w-auto">
                  Registrar llegada
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista general de llegadas</CardTitle>
          <CardDescription>Participantes ordenados por hora de arribo.</CardDescription>
        </CardHeader>
        <CardContent>
          {finishers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no se registraron llegadas.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Dorsal</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                    <TableHead>Distancia</TableHead>
                    <TableHead>Tiempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finishers.map((participant, index) => (
                    <TableRow key={participant.id}>
                      <TableCell className="font-semibold">{index + 1}</TableCell>
                      <TableCell className="font-semibold">{participant.bibNumber}</TableCell>
                      <TableCell>{`${participant.name} ${participant.surname}`}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {participant.categoryId ? (
                          <Badge variant="secondary">{categoriesMap[participant.categoryId] || "Sin categoría"}</Badge>
                        ) : (
                          <Badge variant="outline">Sin categoría</Badge>
                        )}
                      </TableCell>
                      <TableCell>{participant.distance}</TableCell>
                      <TableCell className="font-mono">
                        {formatElapsedTime((participant.finishTime ?? 0) - (participant.startTime ?? 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clasificación en vivo por categoría</CardTitle>
          <CardDescription>Se actualiza automáticamente con cada llegada registrada manualmente.</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryArrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay categorías con llegadas registradas.</p>
          ) : (
            <div className="space-y-6">
              {categoryArrivals.map((category) => (
                <div key={category.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{category.label}</h4>
                    <Badge variant="secondary">{category.members.length}</Badge>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Dorsal</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Tiempo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {category.members.map((participant, index) => (
                          <TableRow key={participant.id}>
                            <TableCell className="font-semibold">{index + 1}</TableCell>
                            <TableCell className="font-semibold">{participant.bibNumber}</TableCell>
                            <TableCell>{`${participant.name} ${participant.surname}`}</TableCell>
                            <TableCell className="font-mono">
                              {formatElapsedTime((participant.finishTime ?? 0) - (participant.startTime ?? 0))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
