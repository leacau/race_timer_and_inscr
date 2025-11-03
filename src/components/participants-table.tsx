"use client";

import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
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
import { MoreVertical, Play, Square, Edit, Trash2, Plus, Upload } from "lucide-react";
import type { Participant, Category } from "@/lib/types";
import { cn, calculateAge, formatElapsedTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AppContext } from "@/context/app-context";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { addParticipant, updateParticipant, deleteParticipant, updateParticipantTime, importFromExcel } from "@/lib/actions";
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
  name: z.string().min(1, "El nombre es requerido"),
  surname: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI/ID es requerido"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Introduce la fecha en formato AAAA-MM-DD"),
  gender: z.enum(["Male", "Female", "Other"]),
  distance: z.enum(["5k", "10k", "21k", "42k"]),
});
type ParticipantFormValues = z.infer<typeof participantSchema>;

export function ParticipantsTable({ participants, categories }: { participants: Participant[]; categories: Category[] }) {
  const { toast } = useToast();
  const { role } = useContext(AppContext);
  const isMobile = useIsMobile();
  const [timers, setTimers] = useState<TimerState>({});
  const [open, setOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryMap = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = category.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  const form = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: { name: "", surname: "", dni: "", birthDate: "", gender: "Male", distance: "5k" },
  });

  const handleOpenDialog = (participant?: Participant) => {
    if (participant) {
      setEditingParticipant(participant);
      form.reset(participant);
    } else {
      setEditingParticipant(null);
      form.reset({ name: "", surname: "", dni: "", birthDate: "", gender: "Male", distance: "5k" });
    }
    setOpen(true);
  };

  const onSubmit = async (values: ParticipantFormValues) => {
    try {
      if (editingParticipant) {
        await updateParticipant({ ...editingParticipant, ...values });
        toast({ title: "Participante Actualizado", description: "El participante ha sido actualizado correctamente." });
      } else {
        await addParticipant(values);
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await importFromExcel(formData);
      toast({
        title: "Importación Exitosa",
        description: `${result.count} participantes importados.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Importación Fallida",
        description: "No se pudieron importar los participantes del archivo.",
      });
    }
  };

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

  const isAdmin = role === 'admin';

  const renderParticipantRow = (p: Participant) => {
    const age = calculateAge(p.birthDate);
    const timer = timers[p.id];
    const isRunning = timer?.isRunning ?? false;
    
    return (
      <TableRow key={p.id}>
        <TableCell className="font-medium">{`${p.name} ${p.surname}`}</TableCell>
        <TableCell className="hidden md:table-cell">{p.dni}</TableCell>
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
            {formatElapsedTime(timer?.elapsed ?? 0)}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            {isAdmin && (
              <Button
                variant={isRunning ? "destructive" : "default"}
                size="sm"
                onClick={() => toggleTimer(p)}
                className="w-[80px]"
              >
                {isRunning ? <Square className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                {isRunning ? "Parar" : "Iniciar"}
              </Button>
            )}
            {isAdmin && (
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
    const age = calculateAge(p.birthDate);
    const timer = timers[p.id];
    const isRunning = timer?.isRunning ?? false;
    return (
      <Card key={p.id}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{`${p.name} ${p.surname}`}</h3>
              <p className="text-sm text-muted-foreground">
                {age} años | {p.distance} | {p.gender === 'Male' ? 'Masculino' : p.gender === 'Female' ? 'Femenino' : 'Otro'}
              </p>
              {p.categoryId && <Badge variant="secondary" className="mt-1">{categoryMap[p.categoryId] || 'N/A'}</Badge>}
            </div>
            {isAdmin && (
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
              {formatElapsedTime(timer?.elapsed ?? 0)}
            </div>
            {isAdmin && (
              <Button variant={isRunning ? "destructive" : "default"} size="sm" onClick={() => toggleTimer(p)} className="w-24">
                {isRunning ? <Square className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                {isRunning ? "Parar" : "Iniciar"}
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
        {isAdmin && (
          <>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Añadir Participante
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Importar Excel
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".xlsx, .csv"
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
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">DNI</TableHead>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingParticipant ? "Editar Participante" : "Añadir Nuevo Participante"}</DialogTitle>
            <DialogDescription>{editingParticipant ? "Actualizar detalles del participante." : "Añadir un nuevo participante a la carrera."}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="surname" render={({ field }) => (
                  <FormItem><FormLabel>Apellido</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="dni" render={({ field }) => (
                <FormItem><FormLabel>DNI / ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="birthDate" render={({ field }) => (
                <FormItem><FormLabel>Fecha de Nacimiento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Género</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="5k">5k</SelectItem><SelectItem value="10k">10k</SelectItem><SelectItem value="21k">21k</SelectItem><SelectItem value="42k">42k</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                <Button type="submit">Guardar Participante</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
