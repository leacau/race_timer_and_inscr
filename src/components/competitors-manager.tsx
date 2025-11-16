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
import { Card, CardContent } from "@/components/ui/card";
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
import { MoreVertical, Edit, Trash2, Plus, Upload } from "lucide-react";
import type { Participant, Category, ParticipantInput } from "@/lib/types";
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
} from "@/lib/actions";
import { useIsMobile } from "@/hooks/use-mobile";

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
] as const;

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
}: {
  participants: Participant[];
  categories: Category[];
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

  const categoryMap = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = category.name;
      return acc;
    }, {} as Record<string, string>);
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
    },
  });

  const handleOpenDialog = (participant?: Participant) => {
    if (participant) {
      setEditingParticipant(participant);
      form.reset({
        ...participant,
        birthDate: participant.birthDate ? new Date(participant.birthDate).toISOString().split("T")[0] : "",
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
      });
    }
    setOpen(true);
  };

  const onSubmit = async (values: ParticipantFormValues) => {
    try {
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
      };

      if (editingParticipant) {
        await updateParticipant(editingParticipant.id, participantInput, raceDate, ageCalculationMethod);
        toast({ title: "Participante Actualizado", description: "El participante ha sido actualizado correctamente." });
      } else {
        await addParticipant(participantInput, raceDate, ageCalculationMethod);
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
        const { age, birthDate: _ignoredBirthDate, ...rest } = validationResult.data;
        const normalizedParticipant: ParticipantInput = {
          ...(rest as Omit<ParticipantInput, "birthDate">),
          birthDate,
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
      try {
        const result = await importParticipants(validParticipants, raceDate, ageCalculationMethod);
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
            {p.categoryId && <Badge variant="secondary" className="mt-1">{categoryMap[p.categoryId] || "N/A"}</Badge>}
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
