"use client";

import React, { useState, useContext, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreVertical, Edit, Trash2, Plus, Upload, Sparkles } from "lucide-react";
import type { Participant, Category, ParticipantInput, Race } from "@/lib/types";
import { calculateAge, deriveBirthDateFromAge } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AppContext } from "@/context/app-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  addParticipant,
  updateParticipant,
  deleteParticipant,
  importParticipants,
  bulkDeleteParticipants,
  assignCategoriesToParticipants,
} from "@/lib/actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Link from "next/link";

const participantSchema = z.object({
  id: z.string().optional(),
  bibNumber: z.string().min(1, "El dorsal es requerido"),
  name: z.string().min(1, "El nombre es requerido"),
  surname: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI/ID es requerido"),
  birthDate: z.string().min(1, "La fecha de nacimiento es requerida"),
  gender: z.enum(["Male", "Female", "Other"]),
  distance: z.enum(["5k", "10k", "21k", "42k"]),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  isSpecial: z.boolean().default(false),
});

type ParticipantFormValues = z.infer<typeof participantSchema>;

type ImportState = {
  file: File | null;
  headers: string[];
  data: any[][];
  mappings: Record<string, string | undefined>;
};

const systemFields = [
  { key: "bibNumber", label: "Dorsal", required: true },
  { key: "name", label: "Nombre", required: true },
  { key: "surname", label: "Apellido", required: true },
  { key: "dni", label: "DNI/ID", required: true },
  { key: "birthDate", label: "Fecha de Nacimiento", required: false },
  { key: "age", label: "Edad", required: false },
  { key: "gender", label: "Género", required: true },
  { key: "distance", label: "Distancia", required: true },
  { key: "city", label: "Ciudad", required: false },
  { key: "province", label: "Provincia", required: false },
  { key: "country", label: "País", required: false },
  { key: "isSpecial", label: "Categoría especial", required: false },
] as const;

const booleanTrueValues = new Set(["1", "true", "si", "sí", "s", "y", "yes", "x", "especial", "special"]);

const parseBooleanish = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return booleanTrueValues.has(normalized);
};

const pairedFields = ["birthDate", "age"] as const;

const isPairedField = (key: string): key is (typeof pairedFields)[number] =>
  (pairedFields as readonly string[]).includes(key);

const importParticipantSchema = z
  .object({
    bibNumber: z.string().min(1, { message: "El dorsal es requerido." }),
    name: z.string().min(1, { message: "El nombre es requerido." }),
    surname: z.string().min(1, { message: "El apellido es requerido." }),
    dni: z.string().min(1, { message: "El DNI/ID es requerido." }),
    birthDate: z
      .string()
      .optional()
      .transform((value) => {
        if (!value) return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }),
    age: z
      .preprocess((value) => {
        if (value === undefined || value === null || value === "") return undefined;
        if (typeof value === "number") return value;
        const numeric = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
        return Number.isNaN(numeric) ? undefined : numeric;
      }, z.number().int().min(1).max(120))
      .optional(),
    gender: z.enum(["Male", "Female", "Other"], {
      errorMap: () => ({ message: "El género es requerido (Male, Female, Other)." }),
    }),
    distance: z.enum(["5k", "10k", "21k", "42k"], {
      errorMap: () => ({ message: "La distancia es requerida (5k, 10k, 21k, 42k)." }),
    }),
    city: z.string().optional(),
    province: z.string().optional(),
    country: z.string().optional(),
    isSpecial: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.birthDate) || typeof data.age === "number", {
    message: "Debe proporcionar fecha de nacimiento o edad.",
    path: ["birthDate"],
  });

type ImportParticipant = z.infer<typeof importParticipantSchema>;

const pairedFieldNotice = "Debes mapear al menos 'Fecha de Nacimiento' o 'Edad'.";

export function CompetitorsManager({
  participants,
  categories,
  raceId,
  activeRace,
}: {
  participants: Participant[];
  categories: Category[];
  raceId: string | null;
  activeRace?: Race | null;
}) {
  const { toast } = useToast();
  const { role, raceDate, ageCalculationMethod } = useContext(AppContext);
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<ImportState>({ file: null, headers: [], data: [], mappings: {} });
  const [isImportMappingOpen, setIsImportMappingOpen] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [assignmentTab, setAssignmentTab] = useState<"auto" | "manual" | "range">("auto");
  const [autoTarget, setAutoTarget] = useState<"selected" | "all">("selected");
  const [autoDistanceEnabled, setAutoDistanceEnabled] = useState(false);
  const [autoDistanceOverride, setAutoDistanceOverride] = useState<Participant["distance"]>("5k");
  const [manualCategoryId, setManualCategoryId] = useState<string>("");
  const [rangeValues, setRangeValues] = useState<{ fromBib: string; toBib: string; distance: Participant["distance"]}>({
    fromBib: "",
    toBib: "",
    distance: "5k",
  });
  const [isAssigning, setIsAssigning] = useState(false);

  const categoryMap = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = category.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  if (!raceId) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Selecciona una carrera</CardTitle>
          <CardDescription>
            Gestiona competidores, importaciones y asignaciones una vez que crees o elijas una carrera activa.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/races">Crear una carrera</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/?">Ir al panel principal</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const raceName = activeRace?.name ?? "Carrera";

  const orderedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  useEffect(() => {
    setSelectedParticipants((prev) => {
      const next = new Set<string>();
      participants.forEach((participant) => {
        if (prev.has(participant.id)) {
          next.add(participant.id);
        }
      });
      return next;
    });
  }, [participants]);

  useEffect(() => {
    if (!isAssignmentDialogOpen) {
      setAssignmentTab("auto");
      setAutoTarget("selected");
      setAutoDistanceEnabled(false);
      setAutoDistanceOverride("5k");
      setManualCategoryId("");
      setRangeValues({ fromBib: "", toBib: "", distance: "5k" });
    }
  }, [isAssignmentDialogOpen]);

  const form = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: {
      bibNumber: "",
      name: "",
      surname: "",
      dni: "",
      birthDate: "",
      gender: "Male",
      distance: "5k",
      city: "",
      province: "",
      country: "",
      isSpecial: false,
    },
  });

  const handleOpenDialog = (participant?: Participant) => {
    if (participant) {
      setEditingParticipant(participant);
      form.reset({
        ...participant,
        birthDate: participant.birthDate ? new Date(participant.birthDate).toISOString().split("T")[0] : "",
        isSpecial: participant.isSpecial,
      });
    } else {
      setEditingParticipant(null);
      form.reset({
        bibNumber: "",
        name: "",
        surname: "",
        dni: "",
        birthDate: "",
        gender: "Male",
        distance: "5k",
        city: "",
        province: "",
        country: "",
        isSpecial: false,
      });
    }
    setOpen(true);
  };

  const onSubmit = async (values: ParticipantFormValues) => {
    try {
      if (!raceId) {
        toast({ variant: "destructive", title: "Selecciona una carrera", description: "Debes elegir una carrera para guardar competidores." });
        return;
      }
      const participantInput: ParticipantInput = {
        bibNumber: values.bibNumber,
        name: values.name,
        surname: values.surname,
        dni: values.dni,
        gender: values.gender,
        distance: values.distance,
        birthDate: values.birthDate,
        city: values.city,
        province: values.province,
        country: values.country,
        isSpecial: values.isSpecial,
      };

      if (editingParticipant) {
        await updateParticipant(editingParticipant.id, participantInput, raceDate, ageCalculationMethod, raceId);
        toast({ title: "Participante Actualizado", description: "El participante ha sido actualizado correctamente." });
      } else {
        await addParticipant(participantInput, raceDate, ageCalculationMethod, raceId);
        toast({ title: "Participante Añadido", description: "El nuevo participante ha sido añadido correctamente." });
      }
      setOpen(false);
    } catch (error) {
      console.error("Error submitting participant:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el participante." });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteParticipant(id);
      toast({ title: "Participante Eliminado", description: "El participante ha sido eliminado correctamente." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el participante." });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedParticipants.size === 0) return;
    if (!window.confirm("¿Eliminar los participantes seleccionados?")) return;
    setIsBulkDeleting(true);
    try {
      await bulkDeleteParticipants(Array.from(selectedParticipants));
      toast({ title: "Participantes eliminados", description: "Los participantes seleccionados fueron eliminados." });
      setSelectedParticipants(new Set());
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron eliminar los participantes seleccionados." });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleAssignmentSubmit = async () => {
    try {
      if (!raceId) {
        toast({ variant: "destructive", title: "Selecciona una carrera", description: "Define una carrera antes de reasignar categorías." });
        return;
      }
      setIsAssigning(true);
      if (assignmentTab === "auto") {
        if (autoTarget === "selected" && selectedCount === 0) {
          toast({ variant: "destructive", title: "Selecciona participantes", description: "Elige al menos un competidor para recalcular." });
          return;
        }
        const target =
          autoTarget === "all"
            ? ({ type: "all" } as const)
            : ({ type: "selection", ids: Array.from(selectedParticipants) } as const);
        await assignCategoriesToParticipants(
          {
            strategy: "auto",
            target,
            distanceOverride: autoDistanceEnabled ? autoDistanceOverride : undefined,
          },
          raceDate,
          ageCalculationMethod,
          raceId
        );
        toast({
          title: "Categorías recalculadas",
          description:
            autoTarget === "all"
              ? "Se recalcularon todas las categorías según edad, sexo y distancia."
              : "Se actualizó la categoría de los competidores seleccionados.",
        });
        if (autoTarget === "selected") {
          setSelectedParticipants(new Set());
        }
      } else if (assignmentTab === "manual") {
        if (selectedCount === 0) {
          toast({ variant: "destructive", title: "Selecciona participantes", description: "Elige a quién asignar la categoría." });
          return;
        }
        if (!manualCategoryId) {
          toast({ variant: "destructive", title: "Categoría requerida", description: "Selecciona una categoría de destino." });
          return;
        }
        await assignCategoriesToParticipants(
          {
            strategy: "manual",
            target: { type: "selection", ids: Array.from(selectedParticipants) },
            categoryId: manualCategoryId === "__none__" ? null : manualCategoryId,
          },
          raceDate,
          ageCalculationMethod,
          raceId
        );
        toast({ title: "Categorías asignadas", description: "Se actualizó la categoría manualmente." });
        setSelectedParticipants(new Set());
      } else {
        if (!rangeValues.fromBib.trim() || !rangeValues.toBib.trim()) {
          toast({ variant: "destructive", title: "Rango requerido", description: "Indica los dorsales inicial y final." });
          return;
        }
        await assignCategoriesToParticipants(
          {
            strategy: "auto",
            target: { type: "range", fromBib: rangeValues.fromBib.trim(), toBib: rangeValues.toBib.trim() },
            distanceOverride: rangeValues.distance,
          },
          raceDate,
          ageCalculationMethod,
          raceId
        );
        toast({
          title: "Rango actualizado",
          description: `Se reasignaron los dorsales ${rangeValues.fromBib} - ${rangeValues.toBib}.`,
        });
      }
      setIsAssignmentDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron actualizar las categorías." });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const headers = jsonData[0]?.map((h) => String(h ?? "").trim()) || [];
      const dataRows = jsonData.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ""));

      const initialMappings: Record<string, string | undefined> = {};
      systemFields.forEach((field) => {
        const foundHeader = headers.find((header) => {
          if (!header) return false;
          const normalizedHeader = header.toLowerCase().replace(/ /g, "");
          const normalizedFieldLabel = field.label.toLowerCase().replace(/ /g, "");
          const normalizedFieldKey = field.key.toLowerCase().replace(/ /g, "");

          return (
            normalizedHeader.includes(normalizedFieldLabel) ||
            normalizedHeader.includes(normalizedFieldKey) ||
            normalizedFieldLabel.includes(normalizedHeader)
          );
        });
        if (foundHeader) {
          initialMappings[field.key] = foundHeader;
        }
      });

      setImportState({ file, headers, data: dataRows, mappings: initialMappings });
      setIsImportMappingOpen(true);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const handleMappingChange = (systemField: string, fileHeader: string) => {
    setImportState((prev) => {
      const nextMappings = { ...prev.mappings };
      if (!fileHeader || fileHeader === "--ignore--") {
        delete nextMappings[systemField];
      } else {
        nextMappings[systemField] = fileHeader;
      }
      return { ...prev, mappings: nextMappings };
    });
  };

  const ensureBirthDate = (participant: ImportParticipant) => {
    if (participant.birthDate) return participant.birthDate;
    if (typeof participant.age === "number") {
      return deriveBirthDateFromAge(participant.age, raceDate);
    }
    return null;
  };

  const handleProcessImport = async () => {
    const { data, headers, mappings } = importState;
    const hasBirthDateMapping = Boolean(mappings.birthDate);
    const hasAgeMapping = Boolean(mappings.age);

    if (!hasBirthDateMapping && !hasAgeMapping) {
      toast({
        variant: "destructive",
        title: "Campo requerido",
        description: "Mapea al menos la fecha de nacimiento o la edad antes de continuar.",
      });
      return;
    }

    const headerIndexMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      if (h) headerIndexMap[h] = i;
    });

    const validParticipants: ParticipantInput[] = [];
    const validationErrors: { row: number; error: any; data: any }[] = [];

    const dataToProcess = data.filter((row) => row.some((cell) => cell !== null && cell !== "" && String(cell).trim() !== ""));

    dataToProcess.forEach((row, rowIndex) => {
      const participantData: { [key: string]: any } = {};
      for (const field of systemFields) {
        const fileHeader = mappings[field.key];
        if (!fileHeader || headerIndexMap[fileHeader] === undefined) continue;

        let value: any = row[headerIndexMap[fileHeader]];
        if (value === undefined || value === null) {
          value = "";
        }

        if (field.key === "birthDate") {
          if (value instanceof Date) {
            const tzoffset = value.getTimezoneOffset() * 60000;
            value = new Date(value.getTime() - tzoffset).toISOString().split("T")[0];
          } else {
            value = String(value).trim();
          }
          participantData[field.key] = value;
          continue;
        }

        if (field.key === "age") {
          const numeric = typeof value === "number" ? value : parseInt(String(value).replace(/[^0-9]/g, ""), 10);
          if (!Number.isNaN(numeric)) {
            participantData[field.key] = numeric;
          }
          continue;
        }

        if (field.key === "isSpecial") {
          participantData[field.key] = parseBooleanish(value);
          continue;
        }

        if (field.key === "gender") {
          const genderRaw = String(value).toLowerCase();
          if (genderRaw.startsWith("m") || genderRaw === "masculino") value = "Male";
          else if (genderRaw.startsWith("f") || genderRaw === "femenino") value = "Female";
          else value = "Other";
        } else if (field.key === "distance") {
          const distanceRaw = String(value).toLowerCase().replace(/ /g, "");
          if (distanceRaw.includes("42")) value = "42k";
          else if (distanceRaw.includes("21")) value = "21k";
          else if (distanceRaw.includes("10")) value = "10k";
          else value = "5k";
        } else if (field.key === "dni") {
          value = String(value).replace(/[.-]/g, "").trim();
        } else {
          value = String(value).trim();
        }
        participantData[field.key] = value;
      }

      const validationResult = importParticipantSchema.safeParse(participantData);

      if (validationResult.success) {
        const birthDate = ensureBirthDate(validationResult.data);
        if (!birthDate) {
          validationErrors.push({ row: rowIndex + 2, error: { message: "Falta fecha o edad" }, data: participantData });
          return;
        }
        const { age, birthDate: _ignoredBirthDate, isSpecial, ...rest } = validationResult.data;
        const normalizedParticipant: ParticipantInput = {
          ...(rest as Omit<ParticipantInput, "birthDate" | "isSpecial">),
          birthDate,
          isSpecial: Boolean(isSpecial),
        };
        validParticipants.push(normalizedParticipant);
      } else {
        validationErrors.push({ row: rowIndex + 2, error: validationResult.error, data: participantData });
      }
    });

    if (validationErrors.length > 0) {
      console.error("Validation errors:", validationErrors);
      toast({
        variant: "destructive",
        title: `${validationErrors.length} Participante(s) con Errores de Validación`,
        description: `No se pudieron validar ${validationErrors.length} de ${dataToProcess.length} participantes. Revisa la consola para más detalles.`,
        duration: 9000,
      });
    }

    if (validParticipants.length > 0) {
      if (!raceId) {
        toast({ variant: "destructive", title: "Selecciona una carrera", description: "Elige una carrera antes de importar." });
        return;
      }
      try {
        const result = await importParticipants(validParticipants, raceDate, ageCalculationMethod, raceId);
        toast({
          title: "Importación Exitosa",
          description: `${result.count} de ${dataToProcess.length} participante(s) importados correctamente.`,
        });
        setIsImportMappingOpen(false);
      } catch (error) {
        console.error("Server import error:", error);
        toast({
          variant: "destructive",
          title: "Error de Importación en Servidor",
          description: "No se pudieron guardar los participantes en la base de datos.",
        });
      }
    } else if (validationErrors.length === 0) {
      toast({
        variant: "default",
        title: "Nada que importar",
        description: "No se encontraron participantes válidos en el archivo.",
      });
    }
  };

  const isAdmin = role === "admin";

  const toggleSelection = (id: string) => {
    setSelectedParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedParticipants(new Set());
      return;
    }
    setSelectedParticipants(new Set(participants.map((p) => p.id)));
  };

  const selectedCount = selectedParticipants.size;

  const renderParticipantRow = (p: Participant) => {
    const age = calculateAge(p.birthDate, raceDate, ageCalculationMethod);
    const isSelected = selectedParticipants.has(p.id);
    return (
      <TableRow key={p.id} data-selected={isSelected}>
        {isAdmin && (
          <TableCell className="w-12">
            <Checkbox checked={isSelected} onCheckedChange={(checked) => toggleSelection(p.id)} aria-label="Seleccionar participante" />
          </TableCell>
        )}
        <TableCell className="font-medium">{p.bibNumber}</TableCell>
        <TableCell className="font-medium">{`${p.name} ${p.surname}`}</TableCell>
        <TableCell className="hidden md:table-cell">{age ?? "-"}</TableCell>
        <TableCell className="hidden md:table-cell">{p.gender === "Male" ? "Masculino" : p.gender === "Female" ? "Femenino" : "Otro"}</TableCell>
        <TableCell>{p.distance}</TableCell>
        <TableCell className="hidden md:table-cell">
          {p.categoryId ? <Badge variant="secondary">{categoryMap[p.categoryId] || "N/A"}</Badge> : <Badge variant="outline">Sin categoría</Badge>}
        </TableCell>
        <TableCell className="hidden sm:table-cell">
          {p.isSpecial ? (
            <Badge variant="default" className="gap-1 text-xs">
              <Sparkles className="h-3 w-3" /> Especial
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="hidden xl:table-cell">{[p.city, p.province, p.country].filter(Boolean).join(", ") || "-"}</TableCell>
        {isAdmin && (
          <TableCell className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleOpenDialog(p)}>
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        )}
      </TableRow>
    );
  };

  const renderParticipantCard = (p: Participant) => {
    const age = calculateAge(p.birthDate, raceDate, ageCalculationMethod);
    const isSelected = selectedParticipants.has(p.id);
    return (
      <Card key={p.id} data-selected={isSelected}>
        <CardContent className="p-4 space-y-3">
          {isAdmin && (
            <div className="flex items-center justify-between">
              <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(p.id)} aria-label="Seleccionar participante" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenDialog(p)}>
                    <Edit className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-primary">#{p.bibNumber}</p>
            <h3 className="font-semibold">{`${p.name} ${p.surname}`}</h3>
            <p className="text-sm text-muted-foreground">
              {age ?? "-"} años | {p.distance} | {p.gender === "Male" ? "Masculino" : p.gender === "Female" ? "Femenino" : "Otro"}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {p.categoryId && <Badge variant="secondary">{categoryMap[p.categoryId] || "N/A"}</Badge>}
              {p.isSpecial && (
                <Badge variant="default" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" /> Especial
                </Badge>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {[p.city, p.province, p.country].filter(Boolean).join(", ") || "Sin ubicación"}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <p className="mb-2 text-sm text-muted-foreground">
        Gestionando competidores de <span className="font-semibold text-foreground">{raceName}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {isAdmin && (
          <>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Añadir Participante
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Importar
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".xlsx, .xls, .csv"
            />
            <Button
              variant="secondary"
              onClick={() => setIsAssignmentDialogOpen(true)}
              disabled={participants.length === 0}
            >
              <Sparkles className="mr-2 h-4 w-4" /> Asignar categorías
            </Button>
            <Button
              variant="destructive"
              disabled={selectedParticipants.size === 0 || isBulkDeleting}
              onClick={handleBulkDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar seleccionados ({selectedParticipants.size})
            </Button>
          </>
        )}
      </div>

      {!isMobile ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedParticipants.size === participants.length && participants.length > 0}
                      onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                )}
                <TableHead>Dorsal</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Edad</TableHead>
                <TableHead className="hidden md:table-cell">Género</TableHead>
                <TableHead>Distancia</TableHead>
                <TableHead className="hidden md:table-cell">Categoría</TableHead>
                <TableHead className="hidden sm:table-cell">Especial</TableHead>
                <TableHead className="hidden xl:table-cell">Ubicación</TableHead>
                {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>{participants.map((p) => renderParticipantRow(p))}</TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-4">
          {participants.map((p) => renderParticipantCard(p))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingParticipant ? "Editar Participante" : "Nuevo Participante"}</DialogTitle>
            <DialogDescription>
              {editingParticipant ? "Actualiza los datos del participante." : "Añade un nuevo participante a la carrera."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="bibNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dorsal</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="dni"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>DNI / ID</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Nacimiento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Género</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Male">Masculino</SelectItem>
                          <SelectItem value="Female">Femenino</SelectItem>
                          <SelectItem value="Other">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="distance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distancia</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="5k">5k</SelectItem>
                          <SelectItem value="10k">10k</SelectItem>
                          <SelectItem value="21k">21k</SelectItem>
                          <SelectItem value="42k">42k</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isSpecial"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Categoría especial</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Marca a las personas con capacidades diferentes u otra categoría destacada.
                      </p>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="province"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provincia</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>País</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit">Guardar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Asignar categorías</DialogTitle>
            <DialogDescription>
              Actualiza manualmente o recalcula las categorías de los competidores seleccionados o de un rango de dorsales.
            </DialogDescription>
          </DialogHeader>
          <Tabs value={assignmentTab} onValueChange={(value) => setAssignmentTab(value as "auto" | "manual" | "range")}
            className="mt-2"
          >
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="auto">Automático</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="range">Por rango</TabsTrigger>
            </TabsList>
            <TabsContent value="auto" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Recalcula la categoría según edad, género y distancia. Puedes aplicarlo a todos o solo a los seleccionados.
              </p>
              <div className="space-y-2">
                <Label>Destino</Label>
                <RadioGroup value={autoTarget} onValueChange={(value) => setAutoTarget(value as "selected" | "all")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="selected" id="auto-selected" />
                    <Label htmlFor="auto-selected" className="font-normal">
                      Solo seleccionados ({selectedCount})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all" id="auto-all" />
                    <Label htmlFor="auto-all" className="font-normal">
                      Todos los competidores ({participants.length})
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-distance"
                    checked={autoDistanceEnabled}
                    onCheckedChange={(checked) => setAutoDistanceEnabled(Boolean(checked))}
                  />
                  <Label htmlFor="auto-distance" className="font-normal">
                    Cambiar distancia antes de recalcular
                  </Label>
                </div>
                {autoDistanceEnabled && (
                  <div>
                    <Label>Distancia a aplicar</Label>
                    <Select value={autoDistanceOverride} onValueChange={(value) => setAutoDistanceOverride(value as Participant["distance"]) }>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecciona distancia" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5k">5k</SelectItem>
                        <SelectItem value="10k">10k</SelectItem>
                        <SelectItem value="21k">21k</SelectItem>
                        <SelectItem value="42k">42k</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="manual" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Asigna directamente la categoría elegida a los competidores seleccionados.
              </p>
              <div className="space-y-2">
                <Label>Categoría destino</Label>
                <Select value={manualCategoryId} onValueChange={setManualCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin categoría</SelectItem>
                    {orderedCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Se aplicará a {selectedCount} competidor(es) seleccionado(s).
              </p>
            </TabsContent>
            <TabsContent value="range" className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Define un rango de dorsales, asigna una distancia y deja que el sistema reacomode la categoría automáticamente.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Dorsal desde</Label>
                  <Input value={rangeValues.fromBib} onChange={(event) => setRangeValues((prev) => ({ ...prev, fromBib: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Dorsal hasta</Label>
                  <Input value={rangeValues.toBib} onChange={(event) => setRangeValues((prev) => ({ ...prev, toBib: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Distancia</Label>
                <Select value={rangeValues.distance} onValueChange={(value) => setRangeValues((prev) => ({ ...prev, distance: value as Participant["distance"] }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona distancia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5k">5k</SelectItem>
                    <SelectItem value="10k">10k</SelectItem>
                    <SelectItem value="21k">21k</SelectItem>
                    <SelectItem value="42k">42k</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleAssignmentSubmit} disabled={isAssigning}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportMappingOpen} onOpenChange={setIsImportMappingOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Mapear Columnas para Importar</DialogTitle>
            <DialogDescription>
              Asigna las columnas de tu archivo a los campos de datos del sistema. Los campos requeridos están marcados con un *.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-2">{pairedFieldNotice}</div>
          <div className="flex-1 overflow-y-auto pr-4 -mr-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {systemFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                    {isPairedField(field.key) && (
                      <span className="ml-1 text-xs text-muted-foreground">(obligatorio al menos uno)</span>
                    )}
                  </Label>
                  <Select
                    onValueChange={(value) => handleMappingChange(field.key, value)}
                    value={importState.mappings[field.key] ?? undefined}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="--ignore--">No importar</SelectItem>
                      {importState.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleProcessImport}>Importar Participantes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
