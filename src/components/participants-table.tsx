

"use client";

import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { MoreVertical, Play, Square, Edit, Trash2, Plus, Upload } from "lucide-react";
import type { Participant, Category } from "@/lib/types";
import { cn, calculateAge, formatElapsedTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AppContext } from "@/context/app-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { addParticipant, updateParticipant, deleteParticipant, updateParticipantTime, importParticipants } from "@/lib/actions";
import { useIsMobile } from "@/hooks/use-mobile";

type TimerState = {
  [key: string]: {
    startTime: number;
    elapsed: number;
    intervalId?: NodeJS.Timeout;
    isRunning: boolean;
  };
};

const participantSchema = z.object({
  id: z.string().optional(),
  bibNumber: z.string().min(1, "El dorsal es requerido"),
  name: z.string().min(1, "El nombre es requerido"),
  surname: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI/ID es requerido"),
  birthDate: z.string().optional(),
  age: z.coerce.number().int().min(0).optional(),
  gender: z.enum(["Male", "Female", "Other"]),
  distance: z.enum(["5k", "10k", "21k", "42k"]),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  kitDelivered: z.boolean().optional(),
}).refine(data => (data.birthDate && data.birthDate.trim() !== '') || (data.age !== undefined && data.age >= 0), {
  message: "Debe proporcionar la fecha de nacimiento o la edad.",
  path: ["birthDate"],
});

type ParticipantFormValues = z.infer<typeof participantSchema>;

type ImportState = {
  file: File | null;
  headers: string[];
  data: any[][];
  mappings: Record<string, string>;
}

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
];

const importParticipantSchema = z.object({
  bibNumber: z.string().min(1, { message: "El dorsal es requerido." }),
  name: z.string().min(1, { message: "El nombre es requerido." }),
  surname: z.string().min(1, { message: "El apellido es requerido." }),
  dni: z.string().min(1, { message: "El DNI/ID es requerido." }),
  birthDate: z.string().optional(),
  age: z.coerce.number().int().min(0).optional(),
  gender: z.enum(['Male', 'Female', 'Other'], {
    errorMap: () => ({ message: 'El género es requerido (Male, Female, Other).' }),
  }),
  distance: z.enum(['5k', '10k', '21k', '42k'], {
    errorMap: () => ({ message: 'La distancia es requerida (5k, 10k, 21k, 42k).' }),
  }),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
}).refine(data => (data.birthDate && data.birthDate.trim() !== '') || (data.age !== undefined && !isNaN(data.age) && data.age >= 0), {
  message: "Debe proporcionar la fecha de nacimiento o la edad.",
  path: ["birthDate"],
});


export function ParticipantsTable({ participants, categories }: { participants: Participant[]; categories: Category[] }) {
  const { toast } = useToast();
  const { role, raceDate, ageCalculationMethod } = useContext(AppContext);
  const isMobile = useIsMobile();
  const [timers, setTimers] = useState<TimerState>({});
  const [open, setOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importState, setImportState] = useState<ImportState>({ file: null, headers: [], data: [], mappings: {} });
  const [isImportMappingOpen, setIsImportMappingOpen] = useState(false);

  const canEdit = role === 'owner' || role === 'admin';
  const canManageKits = canEdit || role === 'loader';

  const categoryMap = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = category.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  const form = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: { name: "", surname: "", dni: "", birthDate: "", gender: "Male", distance: "5k", bibNumber: "", kitDelivered: false },
  });

  const handleOpenDialog = (participant?: Participant) => {
    if (participant) {
      setEditingParticipant(participant);
      form.reset({
        ...participant,
        birthDate: participant.birthDate ? new Date(participant.birthDate).toISOString().split('T')[0] : '',
        age: participant.age,
        kitDelivered: participant.kitDelivered ?? false,
      });
    } else {
      setEditingParticipant(null);
      form.reset({ name: "", surname: "", dni: "", birthDate: "", gender: "Male", distance: "5k", bibNumber: "", kitDelivered: false });
    }
    setOpen(true);
  };

  const kitLocked = !!(editingParticipant?.kitDelivered && form.watch("kitDelivered"));

  const onSubmit = async (values: ParticipantFormValues) => {
    try {
      const payload = { ...values, raceDate: raceDate, ageCalculationMethod };
      if (editingParticipant) {
        await updateParticipant({ ...editingParticipant, ...payload });
        toast({ title: "Participante Actualizado", description: "El participante ha sido actualizado correctamente." });
      } else {
        await addParticipant(payload);
        toast({ title: "Participante Añadido", description: "El nuevo participante ha sido añadido correctamente." });
      }
      setOpen(false);
    } catch (error) {
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const headers = jsonData[0]?.map(h => String(h ?? '').trim()) || [];
        const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== ''));

        const initialMappings: Record<string, string> = {};
        systemFields.forEach(field => {
            const foundHeader = headers.find(header => {
              if (!header) return false;
              const normalizedHeader = header.toLowerCase().replace(/ /g, '');
              const normalizedFieldLabel = field.label.toLowerCase().replace(/ /g, '');
              const normalizedFieldKey = field.key.toLowerCase().replace(/ /g, '');

              return normalizedHeader.includes(normalizedFieldLabel) || normalizedHeader.includes(normalizedFieldKey) || normalizedFieldLabel.includes(normalizedHeader);
            });
            if (foundHeader) {
                initialMappings[field.key] = foundHeader;
            }
        });

        setImportState({ file, headers, data: dataRows, mappings: initialMappings });
        setIsImportMappingOpen(true);
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };
  
  const handleMappingChange = (systemField: string, fileHeader: string) => {
    setImportState(prev => ({
        ...prev,
        mappings: { ...prev.mappings, [systemField]: fileHeader }
    }));
  }
  
  const handleProcessImport = async () => {
    const { data, headers, mappings } = importState;
    const headerIndexMap: Record<string, number> = {};
    headers.forEach((h, i) => headerIndexMap[h] = i);
    
    let validParticipants: (z.infer<typeof importParticipantSchema>)[] = [];
    let validationErrors: { row: number; error: any; data: any }[] = [];

    data.forEach((row, rowIndex) => {
        // Skip empty rows
        if (row.every(cell => cell === null || cell === '')) {
            return;
        }
          
        const participantData: { [key: string]: any } = {};
        for (const field of systemFields) {
          const fileHeader = mappings[field.key];
          if (fileHeader && headerIndexMap[fileHeader] !== undefined) {
            let value: any = row[headerIndexMap[fileHeader]];
            
            if (value === undefined || value === null) {
              value = '';
            }
  
            // Special Parsing Logic
            if (field.key === 'birthDate' && value instanceof Date) {
              // Correctly format date to YYYY-MM-DD, avoiding timezone issues
              const tzoffset = value.getTimezoneOffset() * 60000;
              value = new Date(value.getTime() - tzoffset).toISOString().split('T')[0];
            } else {
               value = String(value).trim();
            }
  
            if (field.key === 'gender') {
              const genderRaw = value.toLowerCase();
              if (genderRaw.startsWith('m') || genderRaw === 'masculino') value = 'Male';
              else if (genderRaw.startsWith('f') || genderRaw === 'femenino') value = 'Female';
              else value = 'Other';
            } else if (field.key === 'distance') {
              const distanceRaw = value.toLowerCase().replace(/ /g, '');
              if (distanceRaw.includes('42')) value = '42k';
              else if (distanceRaw.includes('21')) value = '21k';
              else if (distanceRaw.includes('10')) value = '10k';
              else value = '5k';
            } else if (field.key === 'age') {
              value = parseInt(value.replace(/\D/g, ''), 10);
            } else if (field.key === 'dni') {
              value = value.replace(/[.-]/g, '').trim();
            }
            participantData[field.key] = value;
          }
        }
  
        const validationResult = importParticipantSchema.safeParse(participantData);
        
        if (validationResult.success) {
          validParticipants.push(validationResult.data);
        } else {
          validationErrors.push({ row: rowIndex + 2, error: validationResult.error.flatten(), data: participantData });
        }
      });
  

    if (validationErrors.length > 0) {
        console.error("Validation errors:", validationErrors);
        toast({
          variant: "destructive",
          title: `${validationErrors.length} Participante(s) con Errores de Validación`,
          description: `No se pudieron validar ${validationErrors.length} participantes. Revisa la consola para más detalles.`,
          duration: 9000,
        });
    }

    if (validParticipants.length > 0) {
        try {
            const result = await importParticipants(validParticipants, raceDate, ageCalculationMethod);
            toast({
                title: "Importación Exitosa",
                description: `${result.count} de ${data.length} participante(s) importados correctamente.`,
            });
            setIsImportMappingOpen(false);
        } catch (error) {
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
}


  const toggleTimer = (participant: Participant) => {
    if (timers[participant.id]?.isRunning) {
      // Stop timer
      const finishTime = Date.now();
      const intervalId = timers[participant.id]?.intervalId;
      if (intervalId) clearInterval(intervalId);
      setTimers(prev => ({
        ...prev,
        [participant.id]: { ...prev[participant.id], isRunning: false, intervalId: undefined },
      }));
      updateParticipantTime(participant.id, timers[participant.id].startTime, finishTime);
      toast({
        title: "¡Finalizado!",
        description: `${participant.name} ${participant.surname} ha finalizado la carrera.`,
      });
    } else {
      // Start timer
      const startTime = Date.now();
      const intervalId = setInterval(() => {
        setTimers(prev => ({
          ...prev,
          [participant.id]: { ...prev[participant.id], elapsed: Date.now() - startTime },
        }));
      }, 100);
      setTimers(prev => ({
        ...prev,
        [participant.id]: { startTime, elapsed: 0, intervalId, isRunning: true },
      }));
    }
  };

  useEffect(() => {
    // Initialize timers from participant data
    const initialTimers: TimerState = {};
    participants.forEach(p => {
      if (p.startTime && p.finishTime) {
        initialTimers[p.id] = {
          startTime: p.startTime,
          elapsed: p.finishTime - p.startTime,
          isRunning: false,
        };
      }
    });
    setTimers(initialTimers);

    // Cleanup intervals on unmount
    return () => {
      Object.values(timers).forEach(timer => {
        if (timer.intervalId) clearInterval(timer.intervalId);
      });
    };
  }, [participants]); // Only run on initial participants load

  const renderParticipantRow = (p: Participant) => {
    const age = p.age ?? calculateAge(p.birthDate, raceDate, ageCalculationMethod);
    const timer = timers[p.id];
    const isRunning = timer?.isRunning ?? false;
    
    return (
      <TableRow key={p.id}>
        <TableCell className="font-medium">{p.bibNumber}</TableCell>
        <TableCell className="font-medium">{`${p.name} ${p.surname}`}</TableCell>
        <TableCell className="hidden lg:table-cell">{age}</TableCell>
        <TableCell className="hidden md:table-cell">
          {p.categoryId ? (
            <Badge variant="secondary">{categoryMap[p.categoryId] || 'N/A'}</Badge>
          ) : (
            <Badge variant="outline">Sin categoría</Badge>
          )}
        </TableCell>
        <TableCell>
          <div className={cn("font-mono text-lg", isRunning && "text-accent-foreground animate-pulse")}>
            {formatElapsedTime(timer?.elapsed ?? p.finishTime ? p.finishTime - (p.startTime ?? 0) : 0)}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            {canEdit && (
              <Button
                variant={isRunning ? "destructive" : "default"}
                size="sm"
                onClick={() => toggleTimer(p)}
                className="w-[80px]"
                disabled={!!p.finishTime}
              >
                {p.finishTime ? 'Finalizado' : (isRunning ? <><Square className="mr-2 h-4 w-4" />Parar</> : <><Play className="mr-2 h-4 w-4" />Iniciar</>)}
              </Button>
            )}
            {canEdit && (
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
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };
  
  const renderParticipantCard = (p: Participant) => {
    const age = p.age ?? calculateAge(p.birthDate, raceDate, ageCalculationMethod);
    const timer = timers[p.id];
    const isRunning = timer?.isRunning ?? false;
    return (
      <Card key={p.id}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-semibold text-primary">#{p.bibNumber}</p>
              <h3 className="font-semibold">{`${p.name} ${p.surname}`}</h3>
              <p className="text-sm text-muted-foreground">
                {age} años | {p.distance} | {p.gender === 'Male' ? 'Masculino' : p.gender === 'Female' ? 'Femenino' : 'Otro'}
              </p>
              {p.categoryId && <Badge variant="secondary" className="mt-1">{categoryMap[p.categoryId] || 'N/A'}</Badge>}
            </div>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleOpenDialog(p)}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="flex items-center justify-between mt-4">
             <div className={cn("font-mono text-2xl", isRunning && "text-accent-foreground animate-pulse")}>
              {formatElapsedTime(timer?.elapsed ?? p.finishTime ? p.finishTime - (p.startTime ?? 0) : 0)}
            </div>
            {canEdit && (
              <Button 
                variant={isRunning ? "destructive" : "default"} 
                size="sm" 
                onClick={() => toggleTimer(p)} 
                className="w-24"
                disabled={!!p.finishTime}
              >
                {p.finishTime ? 'Finalizado' : (isRunning ? <><Square className="mr-2 h-4 w-4" />Parar</> : <><Play className="mr-2 h-4 w-4" />Iniciar</>)}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        {canEdit && (
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
          </>
        )}
      </div>

      {isMobile ? (
        <div className="space-y-4">
          {participants.length > 0 ? participants.map(renderParticipantCard) : <p className="text-muted-foreground text-center py-8">Aún no hay participantes.</p>}
        </div>
      ) : (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dorsal</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden lg:table-cell">Edad</TableHead>
                <TableHead className="hidden md:table-cell">Categoría</TableHead>
                <TableHead>Tiempo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.length > 0 ? (
                participants.map(renderParticipantRow)
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Aún no hay participantes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* Add/Edit Participant Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingParticipant ? "Editar Participante" : "Añadir Nuevo Participante"}</DialogTitle>
            <DialogDescription>{editingParticipant ? "Actualizar detalles del participante." : "Añadir un nuevo participante a la carrera."}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="bibNumber" render={({ field }) => (
                <FormItem><FormLabel>Dorsal</FormLabel><FormControl><Input {...field} disabled={!canEdit || kitLocked} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} disabled={!canEdit || kitLocked} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="surname" render={({ field }) => (
                  <FormItem><FormLabel>Apellido</FormLabel><FormControl><Input {...field} disabled={!canEdit || kitLocked} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="dni" render={({ field }) => (
                <FormItem><FormLabel>DNI / ID</FormLabel><FormControl><Input {...field} disabled={!canEdit || kitLocked} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="birthDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Nacimiento</FormLabel>
                    <FormControl><Input type="date" {...field} disabled={!canEdit || kitLocked} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem>
                    <FormLabel>o Edad</FormLabel>
                    <FormControl><Input type="number" {...field} disabled={!canEdit || kitLocked} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Género</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canEdit || kitLocked}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Masculino</SelectItem>
                        <SelectItem value="Female">Femenino</SelectItem>
                        <SelectItem value="Other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="distance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Distancia</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canEdit || kitLocked}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="5k">5k</SelectItem><SelectItem value="10k">10k</SelectItem><SelectItem value="21k">21k</SelectItem><SelectItem value="42k">42k</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField
                control={form.control}
                name="kitDelivered"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(!!checked)}
                        disabled={!canManageKits || editingParticipant?.kitDelivered}
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="!m-0">Kit Entregado</FormLabel>
                      <p className="text-xs text-muted-foreground">Una vez marcado, el corredor ya no se podrá editar.</p>
                    </div>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                <Button type="submit" disabled={!canManageKits}>Guardar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Import Mapping Dialog */}
      <Dialog open={isImportMappingOpen} onOpenChange={setIsImportMappingOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Mapear Columnas para Importar</DialogTitle>
                <DialogDescription>
                    Asigna las columnas de tu archivo a los campos de datos del sistema. Los campos requeridos están marcados con un *.
                </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-4 -mr-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {systemFields.map(field => (
                        <div key={field.key} className="space-y-2">
                           <Label>
                                {field.label}
                                {field.required && <span className="text-destructive"> *</span>}
                            </Label>
                            <Select onValueChange={(value) => handleMappingChange(field.key, value)} value={importState.mappings[field.key]}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar columna..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="--ignore--">No importar</SelectItem>
                                    {importState.headers.map(header => (
                                        <SelectItem key={header} value={header}>{header}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                <Button onClick={handleProcessImport}>Importar Participantes</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
