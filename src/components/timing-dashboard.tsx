"use client";

import React, { useMemo, useState, useContext, useEffect } from "react";
import * as XLSX from "xlsx";
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
import { resetTimingGroup, startTimingGroup, TimingMode, updateParticipantTime } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { Lock, Unlock } from "lucide-react";

const distanceOrder: Record<Participant["distance"], number> = { "5k": 1, "10k": 2, "21k": 3, "42k": 4 };

type TimingGroup = {
  key: string;
  label: string;
  participantCount: number;
  finishedCount: number;
  startTime: number | null;
  actionGroupId: string | null;
};

type ArrivalEntry = {
  id: string;
  participantId: string;
  bibNumber: string;
  displayBib: string;
  name: string;
  surname: string;
  categoryId: string | null;
  distance: Participant["distance"];
  startTime: number;
  finishTime: number;
  isDuplicate?: boolean;
};

const modeOptions: { value: TimingMode; label: string }[] = [
  { value: "general", label: "Largada única" },
  { value: "distance", label: "Por distancia" },
  { value: "category", label: "Por categoría" },
];

const emptyTime = "00:00:00.00";

const genderLabels: Record<Participant["gender"], string> = {
  Male: "Masculino",
  Female: "Femenino",
  Other: "Otro",
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const sanitizeSheetName = (value: string) => {
  const cleaned = value.replace(/[\\/?*\[\]:]/g, " ").trim();
  if (!cleaned) return "Categoría";
  return cleaned.slice(0, 30);
};

const escapePdfText = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const wrapPdfLine = (line: string, maxChars = 100) => {
  if (!line) return [""];
  const words = line.split(/\s+/);
  const result: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      if (current) {
        result.push(current);
        current = word;
      } else {
        result.push(candidate);
        current = "";
      }
    } else {
      current = candidate;
    }
  });
  if (current) {
    result.push(current);
  }
  return result.length > 0 ? result : [line];
};

const buildPdfFromLines = (title: string, lines: string[]) => {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const lineHeight = 14;
  const encoder = new TextEncoder();
  const safeLines = lines.length > 0 ? lines : ["Sin datos para exportar."];
  const pageContents: string[] = [];
  let currentY = pageHeight - margin;
  let currentContent = "";

  const startNewPage = () => {
    if (currentContent) {
      pageContents.push(currentContent);
    }
    currentY = pageHeight - margin;
    currentContent = `BT /F1 16 Tf ${margin} ${currentY} Td (${escapePdfText(title)}) Tj ET\n`;
    currentY -= lineHeight * 1.5;
  };

  startNewPage();

  safeLines.forEach((line) => {
    const fragments = wrapPdfLine(line);
    fragments.forEach((fragment) => {
      if (currentY <= margin) {
        startNewPage();
      }
      currentContent += `BT /F1 10 Tf ${margin} ${currentY} Td (${escapePdfText(fragment)}) Tj ET\n`;
      currentY -= lineHeight;
    });
  });

  if (currentContent) {
    pageContents.push(currentContent);
  }

  if (pageContents.length === 0) {
    pageContents.push(`BT /F1 10 Tf ${margin} ${pageHeight - margin} Td (Sin datos) Tj ET\n`);
  }

  const totalPages = pageContents.length;
  const objects: string[] = new Array(3 + totalPages * 2 + 1).fill("");
  const kids: string[] = [];
  const fontIndex = 3 + totalPages * 2;

  objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj";
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [] /Count ${totalPages} >>\nendobj`;

  pageContents.forEach((content, index) => {
    const contentIndex = 3 + index * 2;
    const pageIndex = contentIndex + 1;
    const length = encoder.encode(content).length;
    objects[contentIndex] = `${contentIndex} 0 obj\n<< /Length ${length} >>\nstream\n${content}endstream\nendobj`;
    objects[pageIndex] = `${pageIndex} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentIndex} 0 R /Resources << /Font << /F1 ${fontIndex} 0 R >> >> >>\nendobj`;
    kids.push(`${pageIndex} 0 R`);
  });

  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${totalPages} >>\nendobj`;
  objects[fontIndex] = `${fontIndex} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = new Array(objects.length).fill(0);

  for (let i = 1; i < objects.length; i++) {
    const obj = objects[i];
    if (!obj) continue;
    offsets[i] = pdf.length;
    pdf += `${obj}\n`;
  }

  const xrefStart = pdf.length;
  const totalObjects = objects.length - 1;
  pdf += `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjects; i++) {
    const offset = String(offsets[i] || 0).padStart(10, "0");
    pdf += `${offset} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
};

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
  const [isLocked, setIsLocked] = useState(false);
  const [stoppedGroups, setStoppedGroups] = useState<
    Record<string, { pausedAt: number; referenceStart: number }>
  >({});
  const [duplicateArrivals, setDuplicateArrivals] = useState<ArrivalEntry[]>([]);
  const [duplicateCounters, setDuplicateCounters] = useState<Record<string, number>>({});

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

  const resolveParticipantsForGroup = (group: TimingGroup) => {
    if (mode === "general") {
      return participants;
    }
    if (mode === "distance") {
      return participants.filter((participant) => participant.distance === group.actionGroupId);
    }
    return participants.filter((participant) => {
      if (!group.actionGroupId) {
        return !participant.categoryId;
      }
      return participant.categoryId === group.actionGroupId;
    });
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

  useEffect(() => {
    setStoppedGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(prev).forEach(([key, value]) => {
        const group = groups.find((g) => g.key === key);
        if (!group || !group.startTime || group.startTime !== value.referenceStart) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [groups]);

  const startTimeLookup = useMemo(() => {
    const lookup: Record<string, number | null> = {};
    groups.forEach((group) => {
      lookup[group.key] = group.startTime;
    });
    return lookup;
  }, [groups]);

  const finisherEntries = useMemo<ArrivalEntry[]>(() => {
    return participants
      .filter((participant) => participant.finishTime && participant.startTime)
      .map((participant) => ({
        id: participant.id,
        participantId: participant.id,
        bibNumber: participant.bibNumber,
        displayBib: participant.bibNumber,
        name: participant.name,
        surname: participant.surname,
        categoryId: participant.categoryId ?? null,
        distance: participant.distance,
        startTime: participant.startTime!,
        finishTime: participant.finishTime!,
      }));
  }, [participants]);

  const participantMapById = useMemo(() => {
    return participants.reduce((acc, participant) => {
      acc[participant.id] = participant;
      return acc;
    }, {} as Record<string, Participant>);
  }, [participants]);

  const finishers = useMemo(() => {
    return [...finisherEntries, ...duplicateArrivals].sort((a, b) => a.finishTime - b.finishTime);
  }, [finisherEntries, duplicateArrivals]);

  const categoryArrivals = useMemo(() => {
    const map = new Map<string, { label: string; members: ArrivalEntry[] }>();
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
    if (
      group.startTime &&
      !stoppedGroups[group.key] &&
      !window.confirm("Ya existe un inicio registrado. ¿Deseas reiniciar este cronómetro?")
    ) {
      return;
    }
    setStartingGroupKey(group.key);
    try {
      await startTimingGroup(mode, group.actionGroupId);
      setStoppedGroups((prev) => {
        if (!prev[group.key]) return prev;
        const next = { ...prev };
        delete next[group.key];
        return next;
      });
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

  const handleStopGroup = (group: TimingGroup) => {
    if (!group.startTime) return;
    setStoppedGroups((prev) => ({
      ...prev,
      [group.key]: { pausedAt: Date.now(), referenceStart: group.startTime! },
    }));
  };

  const handleResetGroup = async (group: TimingGroup) => {
    if (!group.startTime) return;
    const confirmReset = window.confirm(
      "Reseteará el cronómetro y limpiará las llegadas registradas para este grupo. ¿Deseas continuar?"
    );
    if (!confirmReset) {
      return;
    }
    setStartingGroupKey(group.key);
    try {
      await resetTimingGroup(mode, group.actionGroupId);
      setStoppedGroups((prev) => {
        const next = { ...prev };
        delete next[group.key];
        return next;
      });
      const participantsInGroup = resolveParticipantsForGroup(group);
      if (participantsInGroup.length > 0) {
        const ids = new Set(participantsInGroup.map((participant) => participant.id));
        const bibs = new Set(participantsInGroup.map((participant) => participant.bibNumber));
        setDuplicateArrivals((prev) => prev.filter((arrival) => !ids.has(arrival.participantId)));
        setDuplicateCounters((prev) => {
          const next = { ...prev };
          bibs.forEach((bib) => {
            delete next[bib];
          });
          return next;
        });
      }
      toast({
        title: "Cronómetro reseteado",
        description: `Se limpió el grupo ${group.label}.`,
      });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo resetear el cronómetro." });
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
      setManualBib("");
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
      const effectiveStartTime = participant.startTime ?? startTime;

      if (participant.finishTime) {
        const nextIndex = duplicateCounters[bib] ?? 0;
        const suffix = nextIndex === 0 ? "bis" : `bis${nextIndex}`;
        const displayBib = `${bib}${suffix}`;
        const duplicateEntry: ArrivalEntry = {
          id: `${participant.id}-dup-${finishTime}`,
          participantId: participant.id,
          bibNumber: participant.bibNumber,
          displayBib,
          name: participant.name,
          surname: participant.surname,
          categoryId: participant.categoryId ?? null,
          distance: participant.distance,
          startTime: effectiveStartTime,
          finishTime,
          isDuplicate: true,
        };
        setDuplicateArrivals((prev) => [...prev, duplicateEntry]);
        setDuplicateCounters((prev) => ({ ...prev, [bib]: nextIndex + 1 }));
        toast({
          title: "Tiempo duplicado registrado",
          description: `El dorsal ${bib} ya tenía un registro. Se agregó como ${displayBib}.`,
        });
        setManualBib("");
        return;
      }

      await updateParticipantTime(participant.id, effectiveStartTime, finishTime);
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

  const exportGeneral = (format: "xlsx" | "pdf") => {
    if (finishers.length === 0) {
      toast({ title: "Sin datos", description: "Todavía no hay llegadas para exportar." });
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rows = finishers.map((arrival, index) => {
      const participant = participantMapById[arrival.participantId];
      const categoryLabel = arrival.categoryId ? categoriesMap[arrival.categoryId] || "Sin categoría" : "Sin categoría";
      const elapsed = formatElapsedTime(arrival.finishTime - arrival.startTime);
      return {
        "Posición": index + 1,
        Dorsal: arrival.displayBib,
        Nombre: participant?.name ?? arrival.name,
        Apellido: participant?.surname ?? arrival.surname,
        DNI: participant?.dni ?? "",
        Género: participant ? genderLabels[participant.gender] : "",
        Distancia: arrival.distance,
        Categoría: categoryLabel,
        Ciudad: participant?.city ?? "",
        Provincia: participant?.province ?? "",
        País: participant?.country ?? "",
        "Categoría especial": participant?.isSpecial ? "Sí" : "No",
        "Hora de inicio": participant?.startTime ? new Date(participant.startTime).toLocaleString() : "",
        "Hora de llegada": new Date(arrival.finishTime).toLocaleString(),
        Tiempo: elapsed,
      };
    });

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, "General");
      XLSX.writeFile(workbook, `llegadas_general_${timestamp}.xlsx`);
      return;
    }

    const header = "Posición | Dorsal | Nombre completo | Categoría | Distancia | Tiempo";
    const lines = [header, "-".repeat(header.length)];
    rows.forEach((row) => {
      lines.push(
        `${row["Posición"]} | ${row.Dorsal} | ${row.Nombre} ${row.Apellido} | ${row.Categoría} | ${row.Distancia} | ${row.Tiempo}`
      );
    });
    const pdf = buildPdfFromLines("Llegadas generales", lines);
    downloadBlob(pdf, `llegadas_general_${timestamp}.pdf`);
  };

  const exportByCategory = (format: "xlsx" | "pdf") => {
    if (categoryArrivals.length === 0) {
      toast({ title: "Sin datos", description: "Aún no hay categorías con llegadas." });
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      categoryArrivals.forEach((category) => {
        const sheetRows = category.members.map((arrival, index) => ({
          "Posición": index + 1,
          Dorsal: arrival.displayBib,
          Nombre: `${arrival.name} ${arrival.surname}`,
          Distancia: arrival.distance,
          Tiempo: formatElapsedTime(arrival.finishTime - arrival.startTime),
        }));
        const worksheet = XLSX.utils.json_to_sheet(
          sheetRows.length > 0 ? sheetRows : [{ Aviso: "Sin llegadas registradas" }]
        );
        XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(category.label));
      });
      XLSX.writeFile(workbook, `clasificacion_categorias_${timestamp}.xlsx`);
      return;
    }

    const lines: string[] = [];
    categoryArrivals.forEach((category) => {
      lines.push(category.label.toUpperCase());
      lines.push("Posición | Dorsal | Nombre | Tiempo");
      category.members.forEach((arrival, index) => {
        lines.push(
          `${index + 1} | ${arrival.displayBib} | ${arrival.name} ${arrival.surname} | ${formatElapsedTime(
            arrival.finishTime - arrival.startTime
          )}`
        );
      });
      lines.push("");
    });
    const pdf = buildPdfFromLines("Clasificación por categoría", lines);
    downloadBlob(pdf, `clasificacion_categorias_${timestamp}.pdf`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle>Modo de largada</CardTitle>
            {isAdmin && (
              <Button
                type="button"
                variant={isLocked ? "default" : "outline"}
                size="sm"
                onClick={() => setIsLocked((value) => !value)}
                className="flex items-center gap-2"
              >
                {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                <span className="text-xs font-semibold uppercase">
                  {isLocked ? "Bloqueado" : "Desbloqueado"}
                </span>
              </Button>
            )}
          </div>
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
                  {group.startTime
                    ? formatElapsedTime(
                        Math.max(
                          0,
                          (stoppedGroups[group.key]?.pausedAt ?? now) - group.startTime
                        )
                      )
                    : emptyTime}
                </p>
              </div>
              {isAdmin && (
                <Button
                  onClick={() => {
                    if (!group.startTime) {
                      handleStartGroup(group);
                    } else if (stoppedGroups[group.key]) {
                      handleResetGroup(group);
                    } else {
                      handleStopGroup(group);
                    }
                  }}
                  disabled={startingGroupKey === group.key || isLocked}
                  variant={
                    !group.startTime
                      ? "default"
                      : stoppedGroups[group.key]
                      ? "destructive"
                      : "outline"
                  }
                >
                  {group.startTime
                    ? stoppedGroups[group.key]
                      ? "Resetear"
                      : "Detener"
                    : "Iniciar"}
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
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Lista general de llegadas</CardTitle>
              <CardDescription>Participantes ordenados por hora de arribo.</CardDescription>
            </div>
            {finishers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => exportGeneral("xlsx")}>
                  Exportar XLS
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportGeneral("pdf")}>
                  Exportar PDF
                </Button>
              </div>
            )}
          </div>
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
                  {finishers.map((arrival, index) => (
                    <TableRow key={arrival.id}>
                      <TableCell className="font-semibold">{index + 1}</TableCell>
                      <TableCell className="font-semibold">{arrival.displayBib}</TableCell>
                      <TableCell>{`${arrival.name} ${arrival.surname}`}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {arrival.categoryId ? (
                          <Badge variant="secondary">{categoriesMap[arrival.categoryId] || "Sin categoría"}</Badge>
                        ) : (
                          <Badge variant="outline">Sin categoría</Badge>
                        )}
                      </TableCell>
                      <TableCell>{arrival.distance}</TableCell>
                      <TableCell className="font-mono">
                        {formatElapsedTime(arrival.finishTime - arrival.startTime)}
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
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Clasificación en vivo por categoría</CardTitle>
              <CardDescription>Se actualiza automáticamente con cada llegada registrada manualmente.</CardDescription>
            </div>
            {categoryArrivals.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => exportByCategory("xlsx")}>
                  XLS por categoría
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportByCategory("pdf")}>
                  PDF por categoría
                </Button>
              </div>
            )}
          </div>
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
                        {category.members.map((arrival, index) => (
                          <TableRow key={arrival.id}>
                            <TableCell className="font-semibold">{index + 1}</TableCell>
                            <TableCell className="font-semibold">{arrival.displayBib}</TableCell>
                            <TableCell>{`${arrival.name} ${arrival.surname}`}</TableCell>
                            <TableCell className="font-mono">
                              {formatElapsedTime(arrival.finishTime - arrival.startTime)}
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
