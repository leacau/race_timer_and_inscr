"use client";

import React, { useMemo, useState, useContext, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import type { Participant, Category, Race } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AppContext } from "@/context/app-context";
import { formatElapsedTime } from "@/lib/utils";
import {
  finalizeRaceTiming,
  resetRaceTiming,
  resetTimingGroup,
  startTimingGroup,
  TimingMode,
  updateParticipantTime,
} from "@/lib/actions";
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
  gender: Participant["gender"];
  startTime: number;
  finishTime: number;
  isSpecial: boolean;
  isDuplicate?: boolean;
  totalTime?: number | null;
  instanceId?: string | null;
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

const utf8Encoder = new TextEncoder();

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

const wrapText = (line: string, maxChars = 100) => {
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

const encodePdfText = (text: string) => {
  const bytes: number[] = [];

  for (const char of Array.from(text)) {
    const code = char.codePointAt(0)!;
    if (code <= 0xff) {
      bytes.push(code);
    } else {
      // Fallback for characters outside WinAnsi/cp1252 range
      bytes.push("?".charCodeAt(0));
    }
  }

  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `<${hex}>`;
};

type PdfSection = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  columnWeights?: number[];
};

const buildTablesPdf = (title: string, sections: PdfSection[]) => {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const lineGap = 18;
  const rowPadding = 6;
  const textLineHeight = 12;
  const tableWidth = pageWidth - margin * 2;
  const encoder = utf8Encoder;
  const safeSections =
    sections.length > 0
      ? sections
      : [{ title: "Sin datos", headers: ["Información"], rows: [["No hay registros para mostrar"]] }];
  const pageContents: string[] = [];
  let currentY = pageHeight - margin;
  let currentContent = "";

  const startNewPage = () => {
    if (currentContent) {
      pageContents.push(currentContent);
    }
    currentY = pageHeight - margin;
    currentContent = `BT /F2 16 Tf ${margin} ${currentY} Td ${encodePdfText(title)} Tj ET\n`;
    currentY -= lineGap * 2;
  };

  const columnPadding = 8;

  const wrapCell = (text: string, width: number) => {
    const maxChars = Math.max(1, Math.floor((width - columnPadding * 2) / 5.2));
    return wrapText(text, maxChars);
  };

  const measureRowHeight = (cells: string[], columnWidths: number[]) => {
    const maxLines = cells.reduce((acc, cell, index) => {
      const lines = wrapCell(cell, columnWidths[index]).length;
      return Math.max(acc, lines);
    }, 1);
    return rowPadding * 2 + maxLines * textLineHeight;
  };

  const drawRow = (
    cells: string[],
    columnWidths: number[],
    options: { background?: [number, number, number]; textColor?: [number, number, number]; font: string; fontSize: number }
  ) => {
    const normalized = cells.map((cell) => cell ?? "");
    const rowHeight = measureRowHeight(normalized, columnWidths);
    const top = currentY;
    const bottom = currentY - rowHeight;
    const borderColor = "0.82 0.86 0.91";
    if (options.background) {
      currentContent += `${options.background.join(" ")} rg\n${margin} ${bottom} ${tableWidth} ${rowHeight} re f\n`;
    }
    currentContent += `${borderColor} RG\n${margin} ${bottom} ${tableWidth} ${rowHeight} re S\n`;
    let xCursor = margin;
    normalized.forEach((cell, index) => {
      if (index > 0) {
        currentContent += `${xCursor} ${bottom} m ${xCursor} ${top} l S\n`;
      }
      const lines = wrapCell(cell, columnWidths[index]);
      let textY = top - rowPadding;
      const textColor = options.textColor ?? [0, 0, 0];
      lines.forEach((line) => {
        textY -= textLineHeight;
        currentContent += `BT ${options.font} ${options.fontSize} Tf ${textColor.join(" ")} rg ${xCursor + columnPadding} ${textY} Td ${encodePdfText(
          line
        )} Tj ET\n`;
      });
      xCursor += columnWidths[index];
    });
    currentY -= rowHeight;
    currentContent += "0 0 0 rg\n";
  };

  const ensureSpace = (heightNeeded: number) => {
    if (currentY - heightNeeded < margin) {
      startNewPage();
    }
  };

  startNewPage();

  safeSections.forEach((section, sectionIndex) => {
    const rows = section.rows.length > 0 ? section.rows : [["Sin registros"]];
    const weights =
      section.columnWeights && section.columnWeights.length === section.headers.length ? section.columnWeights : undefined;
    const totalWeight = weights?.reduce((sum, value) => sum + value, 0) ?? section.headers.length;
    const columnWidths = section.headers.map((_, index) => (tableWidth * (weights?.[index] ?? 1)) / totalWeight);
    const headerHeight = measureRowHeight(section.headers.map(String), columnWidths);
    const dataHeights = rows.map((row) => measureRowHeight(row.map((cell) => String(cell ?? "")), columnWidths));
    const estimatedHeight = lineGap + headerHeight + dataHeights.reduce((sum, value) => sum + value, 0) + 12;

    ensureSpace(estimatedHeight);

    currentContent += `BT /F2 14 Tf ${margin} ${currentY} Td ${encodePdfText(section.title)} Tj ET\n`;
    currentY -= lineGap;

    drawRow(section.headers.map(String), columnWidths, {
      background: [0.16, 0.2, 0.33],
      textColor: [1, 1, 1],
      font: "/F2",
      fontSize: 10,
    });

    rows.forEach((row, rowIndex) => {
      drawRow(
        row.map((cell) => String(cell ?? "")),
        columnWidths,
        {
          background: rowIndex % 2 === 0 ? [0.94, 0.96, 1] : undefined,
          textColor: [0.05, 0.07, 0.12],
          font: "/F1",
          fontSize: 10,
        }
      );
    });

    currentY -= 12;
    if (sectionIndex < safeSections.length - 1 && currentY < margin + 120) {
      startNewPage();
    }
  });

  if (currentContent) {
    pageContents.push(currentContent);
  }

  const totalPages = pageContents.length;
  const fontCount = 2;
  const fontStartIndex = 3 + totalPages * 2;
  const objects: string[] = new Array(fontStartIndex + fontCount).fill("");
  const kids: string[] = [];

  objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj";
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [] /Count ${totalPages} >>\nendobj`;

  pageContents.forEach((content, index) => {
    const contentIndex = 3 + index * 2;
    const pageIndex = contentIndex + 1;
    const length = encoder.encode(content).length;
    objects[contentIndex] = `${contentIndex} 0 obj\n<< /Length ${length} >>\nstream\n${content}endstream\nendobj`;
    objects[pageIndex] = `${pageIndex} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentIndex} 0 R /Resources << /Font << /F1 ${fontStartIndex} 0 R /F2 ${fontStartIndex + 1} 0 R >> >> >>\nendobj`;
    kids.push(`${pageIndex} 0 R`);
  });

  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${totalPages} >>\nendobj`;
  objects[fontStartIndex] = `${fontStartIndex} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Arial /Encoding /WinAnsiEncoding >>\nendobj`;
  objects[fontStartIndex + 1] = `${fontStartIndex + 1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Arial-Bold /Encoding /WinAnsiEncoding >>\nendobj`;

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
  raceId,
  activeRace,
}: {
  participants: Participant[];
  categories: Category[];
  raceId: string;
  activeRace?: Race | null;
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
  const raceName = activeRace?.name ?? "Carrera";
  const [viewerTab, setViewerTab] = useState<"general" | "categories" | "special">("general");
  const [finalizedWindow, setFinalizedWindow] = useState<{ start: number | null; end: number | null }>(() => ({
    start: activeRace?.raceStartTime ?? null,
    end: activeRace?.raceEndTime ?? null,
  }));
  const raceInstances = useMemo(() => activeRace?.instances ?? [], [activeRace]);
  const isRaceFinalized = useMemo(
    () => Boolean(activeRace?.finalized || activeRace?.raceEndTime || finalizedWindow.end),
    [activeRace?.finalized, activeRace?.raceEndTime, finalizedWindow.end]
  );
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(() =>
    activeRace?.isMultiStage ? raceInstances[0]?.id ?? null : null
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeRace?.isMultiStage) {
      setActiveInstanceId(null);
      return;
    }
    setActiveInstanceId((current) => {
      if (current && raceInstances.some((instance) => instance.id === current)) {
        return current;
      }
      return raceInstances[0]?.id ?? null;
    });
  }, [activeRace?.isMultiStage, raceInstances]);

  useEffect(() => {
    setFinalizedWindow({ start: activeRace?.raceStartTime ?? null, end: activeRace?.raceEndTime ?? null });
  }, [activeRace?.raceEndTime, activeRace?.raceStartTime]);

  const categoriesMap = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = category.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  const baseParticipantMap = useMemo(
    () =>
      participants.reduce((acc, participant) => {
        acc[participant.id] = participant;
        return acc;
      }, {} as Record<string, Participant>),
    [participants]
  );

  const baseParticipants = useMemo(
    () => participants.filter((participant) => !participant.replacedById),
    [participants]
  );

  const activeParticipants = useMemo(() => {
    if (!activeRace?.isMultiStage || !activeInstanceId) {
      return baseParticipants;
    }

    return baseParticipants.map((participant) => {
      const instanceTime = participant.instanceTimes?.[activeInstanceId];
      if (!instanceTime) return participant;
      return {
        ...participant,
        startTime: instanceTime.startTime ?? null,
        finishTime: instanceTime.finishTime ?? null,
      };
    });
  }, [activeInstanceId, activeRace?.isMultiStage, baseParticipants]);

  const getGroupStart = (groupParticipants: Participant[]) => {
    const startTimes = groupParticipants.map((p) => p.startTime).filter(Boolean) as number[];
    if (startTimes.length === 0) return null;
    return Math.min(...startTimes);
  };

  const includedInstanceIds = useMemo(() => {
    if (!activeRace?.isMultiStage) return [] as string[];
    const fromInstances = raceInstances
      .filter((instance) => instance.includeInResult)
      .map((instance) => instance.id);

    if (activeRace.includeInstancesInResult) {
      return fromInstances.length > 0 ? fromInstances : raceInstances.map((instance) => instance.id);
    }

    return fromInstances;
  }, [activeRace?.includeInstancesInResult, activeRace?.isMultiStage, raceInstances]);

  const getTotalDuration = useCallback(
    (participantId: string) => {
      if (includedInstanceIds.length === 0) return null;
      const participant = baseParticipantMap[participantId];
      if (!participant) return null;
      const times = participant.instanceTimes ?? {};
      let total = 0;
      for (const instanceId of includedInstanceIds) {
        const record = times[instanceId];
        if (!record?.startTime || !record?.finishTime) return null;
        total += record.finishTime - record.startTime;
      }
      return total;
    },
    [baseParticipantMap, includedInstanceIds]
  );

  const activeInstance = useMemo(
    () => raceInstances.find((instance) => instance.id === activeInstanceId) ?? null,
    [activeInstanceId, raceInstances]
  );

  const includedInstanceNames = useMemo(() => {
    if (includedInstanceIds.length === 0) return "No se suman instancias";
    const names = raceInstances
      .filter((instance) => includedInstanceIds.includes(instance.id))
      .map((instance) => instance.name);
    return names.length > 0 ? names.join(" · ") : "Instancias sin nombre";
  }, [includedInstanceIds, raceInstances]);

  const resolveParticipantsForGroup = (group: TimingGroup) => {
    if (mode === "general") {
      return activeParticipants;
    }
    if (mode === "distance") {
      return activeParticipants.filter((participant) => participant.distance === group.actionGroupId);
    }
    return activeParticipants.filter((participant) => {
      if (!group.actionGroupId) {
        return !participant.categoryId;
      }
      return participant.categoryId === group.actionGroupId;
    });
  };

  const groups = useMemo<TimingGroup[]>(() => {
    if (activeParticipants.length === 0) return [];

    if (mode === "general") {
      return [
        {
          key: "general",
          label: "Cronómetro general",
          participantCount: activeParticipants.length,
          finishedCount: activeParticipants.filter((p) => p.finishTime).length,
          startTime: getGroupStart(activeParticipants),
          actionGroupId: null,
        },
      ];
    }

    if (mode === "distance") {
      const map = new Map<string, Participant[]>();
      activeParticipants.forEach((participant) => {
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
    activeParticipants.forEach((participant) => {
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
  }, [mode, activeParticipants, categoriesMap]);

  const sanitizeStoppedGroups = useCallback(
    (source: Record<string, { pausedAt: number; referenceStart: number }>) => {
      let changed = false;
      const next = { ...source };
      Object.entries(source).forEach(([key, value]) => {
        const group = groups.find((g) => g.key === key);
        if (!group || !group.startTime || group.startTime !== value.referenceStart) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : source;
    },
    [groups]
  );

  const pausedStorageKey = useMemo(
    () => `timing-paused:${raceId}:${mode}:${activeInstanceId ?? "single"}`,
    [activeInstanceId, mode, raceId]
  );

  useEffect(() => {
    setStoppedGroups((prev) => sanitizeStoppedGroups(prev));
  }, [sanitizeStoppedGroups]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(pausedStorageKey);
    if (!stored) {
      setStoppedGroups({});
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Record<string, { pausedAt: number; referenceStart: number }>;
      setStoppedGroups(sanitizeStoppedGroups(parsed));
    } catch (error) {
      console.error("Error restoring paused timers", error);
      setStoppedGroups({});
    }
  }, [pausedStorageKey, sanitizeStoppedGroups]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(pausedStorageKey, JSON.stringify(stoppedGroups));
  }, [pausedStorageKey, stoppedGroups]);

  const startTimeLookup = useMemo(() => {
    const lookup: Record<string, number | null> = {};
    groups.forEach((group) => {
      lookup[group.key] = group.startTime;
    });
    return lookup;
  }, [groups]);

  const finisherEntries = useMemo<ArrivalEntry[]>(() => {
    return activeParticipants
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
        gender: participant.gender,
        startTime: participant.startTime!,
        finishTime: participant.finishTime!,
        isSpecial: participant.isSpecial ?? false,
        totalTime: getTotalDuration(participant.id),
        instanceId: activeInstanceId ?? null,
      }));
  }, [activeInstanceId, activeParticipants, getTotalDuration]);

  const getElapsedTime = (arrival: ArrivalEntry) => arrival.finishTime - arrival.startTime;
  const getEffectiveDuration = (arrival: ArrivalEntry) => arrival.totalTime ?? getElapsedTime(arrival);

  const participantMapById = useMemo(() => {
    return activeParticipants.reduce((acc, participant) => {
      acc[participant.id] = participant;
      return acc;
    }, {} as Record<string, Participant>);
  }, [activeParticipants]);

  const finishers = useMemo(() => {
    return [...finisherEntries, ...duplicateArrivals].sort(
      (a, b) => getEffectiveDuration(a) - getEffectiveDuration(b)
    );
  }, [duplicateArrivals, finisherEntries]);

  const specialFinishers = useMemo(() => {
    return finishers.filter((arrival) => participantMapById[arrival.participantId]?.isSpecial);
  }, [finishers, participantMapById]);

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

  const categorySpecialArrivals = useMemo(() => {
    return categoryArrivals
      .map((category) => ({
        ...category,
        members: category.members.filter((arrival) => participantMapById[arrival.participantId]?.isSpecial),
      }))
      .filter((category) => category.members.length > 0);
  }, [categoryArrivals, participantMapById]);

  const genderArrivals = useMemo(() => {
    const map = new Map<Participant["gender"], ArrivalEntry[]>();
    finishers.forEach((arrival) => {
      const gender = arrival.gender;
      if (!map.has(gender)) {
        map.set(gender, []);
      }
      map.get(gender)!.push(arrival);
    });
    return Array.from(map.entries())
      .map(([gender, members]) => ({
        key: gender,
        label: genderLabels[gender] ?? gender,
        members,
      }))
      .filter((entry) => entry.members.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [finishers]);

  const genderSpecialArrivals = useMemo(() => {
    return genderArrivals
      .map((entry) => ({
        ...entry,
        members: entry.members.filter((arrival) => participantMapById[arrival.participantId]?.isSpecial),
      }))
      .filter((entry) => entry.members.length > 0);
  }, [genderArrivals, participantMapById]);

  const showTotalColumn = Boolean(activeRace?.isMultiStage && includedInstanceIds.length > 0);
  const currentInstanceLabel = activeInstance?.name ?? (activeRace?.isMultiStage ? "Selecciona instancia" : "General");

  const getGroupKeyForParticipant = (participant: Participant, currentMode: TimingMode) => {
    if (currentMode === "general") return "general";
    if (currentMode === "distance") return `distance:${participant.distance}`;
    const categoryId = participant.categoryId ?? "__sin_categoria__";
    return `category:${categoryId}`;
  };

  const handleStartGroup = async (group: TimingGroup) => {
    if (!isAdmin) return;
    if (isRaceFinalized) {
      toast({
        variant: "destructive",
        title: "Carrera finalizada",
        description: "Resetea la carrera para volver a iniciar los cronómetros.",
      });
      return;
    }
    if (
      group.startTime &&
      !stoppedGroups[group.key] &&
      !window.confirm("Ya existe un inicio registrado. ¿Deseas reiniciar este cronómetro?")
    ) {
      return;
    }
    setStartingGroupKey(group.key);
    try {
      await startTimingGroup(raceId, mode, group.actionGroupId, activeInstanceId);
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
      const message = error instanceof Error ? error.message : "No se pudo iniciar el cronómetro seleccionado.";
      toast({ variant: "destructive", title: "Error", description: message });
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
      await resetTimingGroup(raceId, mode, group.actionGroupId, activeInstanceId);
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
    const participant = activeParticipants.find((p) => p.bibNumber === bib);
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
          gender: participant.gender,
          startTime: effectiveStartTime,
          finishTime,
          isSpecial: participant.isSpecial ?? false,
          isDuplicate: true,
          totalTime: getTotalDuration(participant.id),
          instanceId: activeInstanceId ?? null,
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

      let nextInstanceId: string | null = null;
      if (activeRace?.isMultiStage && activeInstanceId) {
        const currentIndex = raceInstances.findIndex((instance) => instance.id === activeInstanceId);
        if (currentIndex >= 0 && currentIndex < raceInstances.length - 1) {
          nextInstanceId = raceInstances[currentIndex + 1]?.id ?? null;
        }
      }

      await updateParticipantTime(participant.id, effectiveStartTime, finishTime, activeInstanceId, nextInstanceId);
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

  const clearLocalChronometers = useCallback(() => {
    setStoppedGroups({});
    if (typeof window !== "undefined") {
      ["general", "distance", "category"].forEach((storedMode) => {
        const key = `timing-paused:${raceId}:${storedMode}:${activeInstanceId ?? "single"}`;
        localStorage.removeItem(key);
      });
    }
  }, [activeInstanceId, raceId]);

  const handleFinalizeRace = async () => {
    if (!isAdmin) return;
    const confirmFinish = window.confirm(
      "Esto detendrá todos los cronómetros y guardará el horario de fin. Las clasificaciones y tiempos se mantendrán. ¿Deseas continuar?"
    );
    if (!confirmFinish) return;
    try {
      const result = await finalizeRaceTiming(raceId);
      setFinalizedWindow({ start: result.raceStartTime ?? null, end: result.raceEndTime ?? null });
      clearLocalChronometers();
      toast({
        title: "Carrera finalizada",
        description: "Se detuvieron los cronómetros y se guardó la ventana total de la carrera.",
      });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo finalizar la carrera." });
    }
  };

  const handleResetRace = async () => {
    if (!isAdmin) return;
    const confirmReset = window.confirm(
      "Esto borrará todas las llegadas, tiempos y reiniciará los cronómetros a 0. ¿Deseas continuar?"
    );
    if (!confirmReset) return;
    try {
      await resetRaceTiming(raceId);
      clearLocalChronometers();
      setDuplicateArrivals([]);
      setDuplicateCounters({});
      setFinalizedWindow({ start: null, end: null });
      toast({
        title: "Clasificaciones reseteadas",
        description: "Se limpiaron tiempos, clasificaciones y cronómetros de la carrera.",
      });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo resetear la carrera." });
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
      const elapsed = formatElapsedTime(getElapsedTime(arrival));
      const baseRow: Record<string, string | number> = {
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
        Especial: participant?.isSpecial ? "Sí" : "No",
        "Categoría especial": participant?.isSpecial ? "Sí" : "No",
        "Hora de inicio": participant?.startTime ? new Date(participant.startTime).toLocaleString() : "",
        "Hora de llegada": new Date(arrival.finishTime).toLocaleString(),
        Tiempo: elapsed,
      };

      if (showTotalColumn) {
        baseRow["Total acumulado"] = arrival.totalTime ? formatElapsedTime(arrival.totalTime) : "";
      }

      return baseRow;
    });

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, "General");
      if (specialFinishers.length > 0) {
        const specialRows = specialFinishers.map((arrival, index) => {
          const participant = participantMapById[arrival.participantId];
          const categoryLabel = arrival.categoryId ? categoriesMap[arrival.categoryId] || "Sin categoría" : "Sin categoría";
          return {
            "Posición": index + 1,
            Dorsal: arrival.displayBib,
            Nombre: participant?.name ?? arrival.name,
            Apellido: participant?.surname ?? arrival.surname,
            Género: participant ? genderLabels[participant.gender] : "",
            Categoría: categoryLabel,
            Distancia: arrival.distance,
            Tiempo: formatElapsedTime(getElapsedTime(arrival)),
            ...(showTotalColumn
              ? { "Total acumulado": arrival.totalTime ? formatElapsedTime(arrival.totalTime) : "" }
              : {}),
          };
        });
        const specialSheet = XLSX.utils.json_to_sheet(specialRows);
        XLSX.utils.book_append_sheet(workbook, specialSheet, "Especiales");
      }
      XLSX.writeFile(workbook, `llegadas_general_${timestamp}.xlsx`);
      return;
    }

    const generalHeaders = showTotalColumn
      ? ["#", "Dorsal", "Nombre completo", "Especial", "Categoría", "Distancia", "Tiempo", "Total"]
      : ["#", "Dorsal", "Nombre completo", "Especial", "Categoría", "Distancia", "Tiempo"];
    const generalWeights = showTotalColumn ? [0.5, 0.8, 1.3, 0.8, 1, 0.8, 0.7, 0.9] : [0.5, 0.8, 1.3, 0.8, 1, 0.8, 0.7];

    const pdfSections: PdfSection[] = [
      {
        title: "Clasificación general",
        headers: generalHeaders,
        columnWeights: generalWeights,
        rows: rows.map((row) => {
          const base = [
            row["Posición"],
            row.Dorsal,
            `${row.Nombre} ${row.Apellido}`.trim(),
            row.Especial,
            row["Categoría"],
            String(row.Distancia).toUpperCase(),
            row.Tiempo,
          ];
          if (showTotalColumn) {
            base.push((row as Record<string, string>)["Total acumulado"] ?? "-");
          }
          return base;
        }),
      },
    ];

    if (specialFinishers.length > 0) {
      pdfSections.push({
        title: "Clasificación especial",
        headers: showTotalColumn
          ? ["#", "Dorsal", "Nombre", "Categoría", "Distancia", "Tiempo", "Total"]
          : ["#", "Dorsal", "Nombre", "Categoría", "Distancia", "Tiempo"],
        columnWeights: showTotalColumn ? [0.5, 0.8, 1.4, 1, 0.7, 0.7, 0.9] : [0.5, 0.8, 1.6, 1.1, 0.8, 0.7],
        rows: specialFinishers.map((arrival, index) => {
          const base = [
            index + 1,
            arrival.displayBib,
            `${arrival.name} ${arrival.surname}`,
            arrival.categoryId ? categoriesMap[arrival.categoryId] || "Sin categoría" : "Sin categoría",
            arrival.distance.toUpperCase(),
            formatElapsedTime(getElapsedTime(arrival)),
          ];
          if (showTotalColumn) {
            base.push(arrival.totalTime ? formatElapsedTime(arrival.totalTime) : "-");
          }
          return base;
        }),
      });
    }

    const pdf = buildTablesPdf("Llegadas generales", pdfSections);
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
          Especial: participantMapById[arrival.participantId]?.isSpecial ? "Sí" : "No",
          Distancia: arrival.distance,
          Tiempo: formatElapsedTime(getElapsedTime(arrival)),
        }));
        const worksheet = XLSX.utils.json_to_sheet(
          sheetRows.length > 0 ? sheetRows : [{ Aviso: "Sin llegadas registradas" }]
        );
        XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(category.label));
      });

      if (categorySpecialArrivals.length > 0) {
        categorySpecialArrivals.forEach((category) => {
          const sheetRows = category.members.map((arrival, index) => ({
            "Posición": index + 1,
            Dorsal: arrival.displayBib,
            Nombre: `${arrival.name} ${arrival.surname}`,
            Tiempo: formatElapsedTime(getElapsedTime(arrival)),
          }));
          const worksheet = XLSX.utils.json_to_sheet(
            sheetRows.length > 0 ? sheetRows : [{ Aviso: "Sin llegadas registradas" }]
          );
          XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            sanitizeSheetName(`Especiales - ${category.label}`)
          );
        });
      }
      XLSX.writeFile(workbook, `clasificacion_categorias_${timestamp}.xlsx`);
      return;
    }

    const pdf = buildTablesPdf(
      "Clasificación por categoría",
      [
        ...categoryArrivals.map((category) => ({
          title: category.label,
          headers: ["#", "Dorsal", "Nombre", "Especial", "Tiempo"],
          columnWeights: [0.5, 0.7, 1.6, 0.7, 0.7],
          rows: category.members.map((arrival, index) => [
            index + 1,
            arrival.displayBib,
            `${arrival.name} ${arrival.surname}`,
            participantMapById[arrival.participantId]?.isSpecial ? "Sí" : "No",
            formatElapsedTime(getElapsedTime(arrival)),
          ]),
        })),
        ...categorySpecialArrivals.map((category) => ({
          title: `Especiales · ${category.label}`,
          headers: ["#", "Dorsal", "Nombre", "Tiempo"],
          columnWeights: [0.5, 0.7, 1.8, 0.7],
          rows: category.members.map((arrival, index) => [
            index + 1,
            arrival.displayBib,
            `${arrival.name} ${arrival.surname}`,
            formatElapsedTime(getElapsedTime(arrival)),
          ]),
        })),
      ]
    );
    downloadBlob(pdf, `clasificacion_categorias_${timestamp}.pdf`);
  };

  const exportByGender = (format: "xlsx" | "pdf") => {
    if (genderArrivals.length === 0) {
      toast({ title: "Sin datos", description: "Todavía no hay llegadas clasificadas por sexo." });
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "xlsx") {
      const workbook = XLSX.utils.book_new();
      genderArrivals.forEach((genderGroup) => {
        const sheetRows = genderGroup.members.map((arrival, index) => ({
          "Posición": index + 1,
          Dorsal: arrival.displayBib,
          Nombre: `${arrival.name} ${arrival.surname}`,
          Especial: participantMapById[arrival.participantId]?.isSpecial ? "Sí" : "No",
          Categoría: arrival.categoryId ? categoriesMap[arrival.categoryId] ?? "Sin categoría" : "Sin categoría",
          Distancia: arrival.distance,
          Tiempo: formatElapsedTime(getElapsedTime(arrival)),
        }));
        const worksheet = XLSX.utils.json_to_sheet(
          sheetRows.length > 0 ? sheetRows : [{ Aviso: "Sin llegadas registradas" }]
        );
        XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(genderGroup.label));
      });

      if (genderSpecialArrivals.length > 0) {
        genderSpecialArrivals.forEach((genderGroup) => {
          const sheetRows = genderGroup.members.map((arrival, index) => ({
            "Posición": index + 1,
            Dorsal: arrival.displayBib,
            Nombre: `${arrival.name} ${arrival.surname}`,
            Categoría: arrival.categoryId ? categoriesMap[arrival.categoryId] ?? "Sin categoría" : "Sin categoría",
            Distancia: arrival.distance,
            Tiempo: formatElapsedTime(getElapsedTime(arrival)),
          }));
          const worksheet = XLSX.utils.json_to_sheet(
            sheetRows.length > 0 ? sheetRows : [{ Aviso: "Sin llegadas registradas" }]
          );
          XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(`Especiales - ${genderGroup.label}`));
        });
      }
      XLSX.writeFile(workbook, `clasificacion_genero_${timestamp}.xlsx`);
      return;
    }

    const pdf = buildTablesPdf(
      "Clasificación general por sexo",
      [
        ...genderArrivals.map((genderGroup) => ({
          title: genderGroup.label,
          headers: ["#", "Dorsal", "Nombre", "Especial", "Categoría", "Distancia", "Tiempo"],
          columnWeights: [0.5, 0.7, 1.4, 0.8, 1, 0.8, 0.7],
          rows: genderGroup.members.map((arrival, index) => [
            index + 1,
            arrival.displayBib,
            `${arrival.name} ${arrival.surname}`,
            participantMapById[arrival.participantId]?.isSpecial ? "Sí" : "No",
            arrival.categoryId ? categoriesMap[arrival.categoryId] ?? "Sin categoría" : "Sin categoría",
            arrival.distance.toUpperCase(),
            formatElapsedTime(getElapsedTime(arrival)),
          ]),
        })),
        ...genderSpecialArrivals.map((genderGroup) => ({
          title: `Especiales · ${genderGroup.label}`,
          headers: ["#", "Dorsal", "Nombre", "Categoría", "Distancia", "Tiempo"],
          columnWeights: [0.5, 0.7, 1.6, 1.1, 0.8, 0.7],
          rows: genderGroup.members.map((arrival, index) => [
            index + 1,
            arrival.displayBib,
            `${arrival.name} ${arrival.surname}`,
            arrival.categoryId ? categoriesMap[arrival.categoryId] ?? "Sin categoría" : "Sin categoría",
            arrival.distance.toUpperCase(),
            formatElapsedTime(getElapsedTime(arrival)),
          ]),
        })),
      ]
    );
    downloadBlob(pdf, `clasificacion_genero_${timestamp}.pdf`);
  };

  const showGeneralSections = isAdmin || viewerTab === "general";
  const showCategorySections = isAdmin || viewerTab === "categories";
  const showSpecialSections = isAdmin || viewerTab === "special";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Cronometrando: <span className="font-semibold text-foreground">{raceName}</span>
      </div>
      {activeRace?.isMultiStage && (
        <Card>
          <CardHeader>
            <CardTitle>Instancia en medición</CardTitle>
            <CardDescription>
              Selecciona la etapa que estás midiendo. El total se calculará con las instancias marcadas
              para sumar.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[320px_1fr] md:items-center">
            <div className="space-y-2">
              <Label>Instancia actual</Label>
              <Select value={activeInstanceId ?? ""} onValueChange={(value) => setActiveInstanceId(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una instancia" />
                </SelectTrigger>
                <SelectContent>
                  {raceInstances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {instance.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Instancia seleccionada: <span className="font-semibold text-foreground">{currentInstanceLabel}</span>
              </p>
              <p>
                Instancias que suman al resultado: <span className="font-semibold text-foreground">{includedInstanceNames}</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Finalizar o reiniciar la carrera</CardTitle>
            <CardDescription>
              Detén todos los cronómetros al terminar la prueba o reinicia los datos para comenzar de nuevo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 md:items-center">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Inicio registrado: {finalizedWindow.start ? new Date(finalizedWindow.start).toLocaleString() : "-"}
              </p>
              <p>
                Fin registrado: {finalizedWindow.end ? new Date(finalizedWindow.end).toLocaleString() : "-"}
              </p>
              {activeRace?.timingAggregation === "multiple" && (
                <p>
                  Al finalizar cada jornada podrás sumar tiempos o puntos de las instancias o días completados.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button variant="secondary" onClick={handleFinalizeRace} disabled={startingGroupKey !== null}>
                Finalizar carrera
              </Button>
              <Button variant="destructive" onClick={handleResetRace} disabled={startingGroupKey !== null}>
                Resetear datos y cronómetros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
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
            <RadioGroup
              value={mode}
              onValueChange={(value) => setMode(value as TimingMode)}
              className="grid gap-4 md:grid-cols-3"
            >
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
      )}

      {isAdmin && (
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
                        isRaceFinalized
                          ? 0
                          : Math.max(
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
                  disabled={startingGroupKey === group.key || isLocked || isRaceFinalized}
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
      )}

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

      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Clasificación en vivo</CardTitle>
            <CardDescription>Elige la vista deseada para los resultados.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={viewerTab} onValueChange={(value) => setViewerTab(value as "general" | "categories" | "special")}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="categories">Categorías</TabsTrigger>
                <TabsTrigger value="special">Especial</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {showGeneralSections && (
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
                    <TableHead>Especial</TableHead>
                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                    <TableHead>Distancia</TableHead>
                    <TableHead>Tiempo</TableHead>
                    {showTotalColumn && <TableHead>Total acumulado</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finishers.map((arrival, index) => (
                    <TableRow key={arrival.id}>
                      <TableCell className="font-semibold">{index + 1}</TableCell>
                      <TableCell className="font-semibold">{arrival.displayBib}</TableCell>
                      <TableCell>{`${arrival.name} ${arrival.surname}`}</TableCell>
                      <TableCell>
                        {participantMapById[arrival.participantId]?.isSpecial ? (
                          <Badge variant="secondary">Especial</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {arrival.categoryId ? (
                          <Badge variant="secondary">{categoriesMap[arrival.categoryId] || "Sin categoría"}</Badge>
                        ) : (
                          <Badge variant="outline">Sin categoría</Badge>
                        )}
                      </TableCell>
                      <TableCell>{arrival.distance}</TableCell>
                      <TableCell className="font-mono">
                        {formatElapsedTime(getElapsedTime(arrival))}
                      </TableCell>
                      {showTotalColumn && (
                        <TableCell className="font-mono">
                          {arrival.totalTime ? formatElapsedTime(arrival.totalTime) : "-"}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {showCategorySections && (
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
                          <TableHead>Especial</TableHead>
                          <TableHead>Tiempo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {category.members.map((arrival, index) => (
                          <TableRow key={arrival.id}>
                            <TableCell className="font-semibold">{index + 1}</TableCell>
                            <TableCell className="font-semibold">{arrival.displayBib}</TableCell>
                            <TableCell>{`${arrival.name} ${arrival.surname}`}</TableCell>
                            <TableCell>
                              {participantMapById[arrival.participantId]?.isSpecial ? (
                                <Badge variant="secondary">Especial</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">
                              {formatElapsedTime(getElapsedTime(arrival))}
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
      )}

      {showGeneralSections && (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Clasificación general por sexo</CardTitle>
              <CardDescription>Visualiza los arribos agrupados por género.</CardDescription>
            </div>
            {genderArrivals.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => exportByGender("xlsx")}>
                  XLS por sexo
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportByGender("pdf")}>
                  PDF por sexo
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {genderArrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no se registraron llegadas para esta clasificación.</p>
          ) : (
            <div className="space-y-6">
              {genderArrivals.map((gender) => (
                <div key={gender.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{gender.label}</h4>
                    <Badge variant="secondary">{gender.members.length}</Badge>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Dorsal</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Especial</TableHead>
                          <TableHead className="hidden md:table-cell">Categoría</TableHead>
                          <TableHead>Distancia</TableHead>
                          <TableHead>Tiempo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gender.members.map((arrival, index) => (
                          <TableRow key={`${gender.key}-${arrival.id}`}>
                            <TableCell className="font-semibold">{index + 1}</TableCell>
                            <TableCell className="font-semibold">{arrival.displayBib}</TableCell>
                            <TableCell>{`${arrival.name} ${arrival.surname}`}</TableCell>
                            <TableCell>
                              {participantMapById[arrival.participantId]?.isSpecial ? (
                                <Badge variant="secondary">Especial</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {arrival.categoryId ? (
                                <Badge variant="secondary">{categoriesMap[arrival.categoryId] || "Sin categoría"}</Badge>
                              ) : (
                                <Badge variant="outline">Sin categoría</Badge>
                              )}
                            </TableCell>
                            <TableCell>{arrival.distance}</TableCell>
                            <TableCell className="font-mono">
                              {formatElapsedTime(getElapsedTime(arrival))}
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
      )}

      {showSpecialSections && (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Clasificaciones para corredores especiales</CardTitle>
              <CardDescription>
                Se muestran con detalle en cada clasificación y en apartados exclusivos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {specialFinishers.length === 0 && categorySpecialArrivals.length === 0 && genderSpecialArrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay corredores especiales en el cronometraje.</p>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">General especiales</h4>
                  <Badge variant="secondary">{specialFinishers.length}</Badge>
                </div>
                {specialFinishers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin llegadas especiales registradas.</p>
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
                        {specialFinishers.map((arrival, index) => (
                          <TableRow key={`special-${arrival.id}`}>
                            <TableCell className="font-semibold">{index + 1}</TableCell>
                            <TableCell className="font-semibold">{arrival.displayBib}</TableCell>
                            <TableCell className="flex items-center gap-2">
                              {`${arrival.name} ${arrival.surname}`}
                              <Badge variant="secondary">Especial</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {arrival.categoryId ? (
                                <Badge variant="secondary">{categoriesMap[arrival.categoryId] || "Sin categoría"}</Badge>
                              ) : (
                                <Badge variant="outline">Sin categoría</Badge>
                              )}
                            </TableCell>
                            <TableCell>{arrival.distance}</TableCell>
                            <TableCell className="font-mono">
                              {formatElapsedTime(getElapsedTime(arrival))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Especiales por categoría</h4>
                  <Badge variant="secondary">{categorySpecialArrivals.length}</Badge>
                </div>
                {categorySpecialArrivals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay corredores especiales clasificados por categoría.</p>
                ) : (
                  <div className="space-y-4">
                    {categorySpecialArrivals.map((category) => (
                      <div key={`special-cat-${category.key}`} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="font-semibold">{category.label}</h5>
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
                                <TableRow key={`special-cat-${category.key}-${arrival.id}`}>
                                  <TableCell className="font-semibold">{index + 1}</TableCell>
                                  <TableCell className="font-semibold">{arrival.displayBib}</TableCell>
                                  <TableCell className="flex items-center gap-2">
                                    {`${arrival.name} ${arrival.surname}`}
                                    <Badge variant="secondary">Especial</Badge>
                                  </TableCell>
                                  <TableCell className="font-mono">
                                    {formatElapsedTime(getElapsedTime(arrival))}
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
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Especiales por sexo</h4>
                  <Badge variant="secondary">{genderSpecialArrivals.length}</Badge>
                </div>
                {genderSpecialArrivals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay corredores especiales clasificados por sexo.</p>
                ) : (
                  <div className="space-y-4">
                    {genderSpecialArrivals.map((gender) => (
                      <div key={`special-gender-${gender.key}`} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h5 className="font-semibold">{gender.label}</h5>
                          <Badge variant="secondary">{gender.members.length}</Badge>
                        </div>
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
                              {gender.members.map((arrival, index) => (
                                <TableRow key={`special-gender-${gender.key}-${arrival.id}`}>
                                  <TableCell className="font-semibold">{index + 1}</TableCell>
                                  <TableCell className="font-semibold">{arrival.displayBib}</TableCell>
                                  <TableCell className="flex items-center gap-2">
                                    {`${arrival.name} ${arrival.surname}`}
                                    <Badge variant="secondary">Especial</Badge>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    {arrival.categoryId ? (
                                      <Badge variant="secondary">{categoriesMap[arrival.categoryId] || "Sin categoría"}</Badge>
                                    ) : (
                                      <Badge variant="outline">Sin categoría</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>{arrival.distance}</TableCell>
                                  <TableCell className="font-mono">
                                    {formatElapsedTime(getElapsedTime(arrival))}
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
              </div>
            </>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
