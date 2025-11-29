"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { addRace, deleteRace, updateRace } from "@/lib/actions";
import type { Race } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2, Plus, Pencil } from "lucide-react";

const raceSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  eventDate: z.string().min(1, "Define una fecha"),
});

type RaceFormValues = z.infer<typeof raceSchema>;

export function RacesManager({ races }: { races: Race[] }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<RaceFormValues>({
    resolver: zodResolver(raceSchema),
    defaultValues: { name: "", eventDate: new Date().toISOString().split("T")[0] },
  });

  const sortedRaces = useMemo(
    () => [...races].sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    [races]
  );

  const handleOpen = (race?: Race) => {
    if (race) {
      setEditingRace(race);
      form.reset({ name: race.name, eventDate: race.eventDate });
    } else {
      setEditingRace(null);
      form.reset({ name: "", eventDate: new Date().toISOString().split("T")[0] });
    }
    setDialogOpen(true);
  };

  const onSubmit = (values: RaceFormValues) => {
    startTransition(async () => {
      try {
        if (editingRace) {
          await updateRace(editingRace.id, values);
          toast({ title: "Carrera actualizada", description: "Los datos se guardaron correctamente." });
        } else {
          await addRace(values);
          toast({ title: "Carrera creada", description: "Ya puedes cargar categorías y competidores." });
        }
        setDialogOpen(false);
      } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la carrera." });
      }
    });
  };

  const handleDelete = (race: Race) => {
    if (!window.confirm(`¿Eliminar la carrera ${race.name}?`)) return;
    startTransition(async () => {
      try {
        await deleteRace(race.id);
        toast({ title: "Carrera eliminada", description: "Se eliminaron los datos de la carrera." });
      } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la carrera." });
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Mis carreras</CardTitle>
          <p className="text-sm text-muted-foreground">Crea múltiples carreras y administra sus fechas oficiales.</p>
        </div>
        <Button onClick={() => handleOpen()} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Nueva carrera
        </Button>
      </CardHeader>
      <CardContent>
        {sortedRaces.length === 0 ? (
          <p className="text-muted-foreground">Aún no creaste carreras.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-48">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRaces.map((race) => (
                  <TableRow key={race.id}>
                    <TableCell className="font-medium">{race.name}</TableCell>
                    <TableCell>{race.eventDate ? format(new Date(race.eventDate), "PPP", { locale: es }) : "Sin fecha"}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button asChild size="sm">
                        <Link href={`/races/${race.id}`}>Abrir</Link>
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleOpen(race)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDelete(race)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRace ? "Editar carrera" : "Nueva carrera"}</DialogTitle>
            <DialogDescription>Define el nombre y la fecha oficial del evento.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder="Maratón Ciudad" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {editingRace ? "Guardar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
