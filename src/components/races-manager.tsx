"use client";

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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const distanceOptionPreset = ["5k", "10k", "21k", "42k"] as const;

const raceSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  eventDate: z.string().min(1, "Define una fecha"),
  distances: z.array(z.string()).min(1, "Agrega al menos una distancia"),
  ageCalculationMethod: z.enum(["raceDay", "endOfYear"]),
  registrationsOpen: z.boolean().default(true),
});

type RaceFormValues = z.infer<typeof raceSchema>;

export function RacesManager({ races }: { races: Race[] }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [isPending, startTransition] = useTransition();
  const [customDistance, setCustomDistance] = useState("");
  const [customUnit, setCustomUnit] = useState<"k" | "m">("k");
  const form = useForm<RaceFormValues>({
    resolver: zodResolver(raceSchema),
    defaultValues: {
      name: "",
      eventDate: new Date().toISOString().split("T")[0],
      distances: [...distanceOptionPreset],
      ageCalculationMethod: "raceDay",
      registrationsOpen: true,
    },
  });

  const sortedRaces = useMemo(
    () => [...races].sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    [races]
  );

  const handleOpen = (race?: Race) => {
    if (race) {
      setEditingRace(race);
      form.reset({
        name: race.name,
        eventDate: race.eventDate,
        distances: race.distances ?? [...distanceOptionPreset],
        ageCalculationMethod: race.ageCalculationMethod ?? "raceDay",
        registrationsOpen: race.registrationsOpen ?? true,
      });
    } else {
      setEditingRace(null);
      form.reset({
        name: "",
        eventDate: new Date().toISOString().split("T")[0],
        distances: [...distanceOptionPreset],
        ageCalculationMethod: "raceDay",
        registrationsOpen: true,
      });
    }
    setCustomDistance("");
    setCustomUnit("k");
    setDialogOpen(true);
  };

  const toggleDistance = (distance: string) => {
    const current = form.getValues("distances");
    if (current.includes(distance)) {
      form.setValue(
        "distances",
        current.filter((d) => d !== distance)
      );
    } else {
      form.setValue("distances", [...current, distance]);
    }
  };

  const handleAddCustomDistance = () => {
    const numeric = customDistance.trim();
    if (!numeric) return;
    const label = `${numeric}${customUnit}`;
    toggleDistance(label);
    setCustomDistance("");
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
                  <TableHead className="w-40">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRaces.map((race) => (
                  <TableRow key={race.id}>
                    <TableCell className="font-medium">{race.name}</TableCell>
                    <TableCell>{race.eventDate ? format(new Date(race.eventDate), "PPP", { locale: es }) : "Sin fecha"}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button variant="secondary" size="sm" asChild>
                        <a href={`/races/${race.id}`}>Gestionar</a>
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
                name="distances"
                render={() => (
                  <FormItem>
                    <FormLabel>Distancias</FormLabel>
                    <div className="grid gap-2">
                      <div className="flex flex-wrap gap-2">
                        {distanceOptionPreset.map((distance) => (
                          <Badge
                            key={distance}
                            variant={form.getValues("distances").includes(distance) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleDistance(distance)}
                          >
                            {distance}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Otra distancia"
                          value={customDistance}
                          onChange={(e) => setCustomDistance(e.target.value)}
                        />
                        <Select value={customUnit} onValueChange={(value) => setCustomUnit(value as "k" | "m") }>
                          <SelectTrigger className="w-24">
                            <SelectValue placeholder="Unidad" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="k">K</SelectItem>
                            <SelectItem value="m">M</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" onClick={handleAddCustomDistance}>
                          Agregar
                        </Button>
                      </div>
                      {form.getValues("distances").length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {form.getValues("distances").map((distance) => (
                            <Badge key={distance} variant="secondary" className="flex items-center gap-1">
                              {distance.toUpperCase()}
                              <button type="button" onClick={() => toggleDistance(distance)} className="text-muted-foreground">
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
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
              <FormField
                control={form.control}
                name="ageCalculationMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Determinación de edad</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="raceDay">Al día de la carrera</SelectItem>
                        <SelectItem value="endOfYear">A fin de año</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="registrationsOpen"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Inscripciones</FormLabel>
                      <DialogDescription className="mt-1 text-sm text-muted-foreground">
                        Abiertas permiten cargar nuevos corredores. Al cerrarlas, no se podrán agregar participantes.
                      </DialogDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
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
