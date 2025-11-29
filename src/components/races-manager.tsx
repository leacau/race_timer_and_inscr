"use client";

import Link from "next/link";
import { useContext, useMemo, useState, useTransition } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { addRace, deleteRace, updateRace } from "@/lib/actions";
import type { Race, RaceInput } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2, Plus, Pencil } from "lucide-react";
import { AppContext } from "@/context/app-context";
import { nanoid } from "nanoid";

const raceSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  eventDate: z.string().min(1, "Define una fecha"),
  ageCalculationMethod: z.enum(["raceDay", "endOfYear"]),
  discipline: z.enum(["pedestrismo", "duatlon", "triatlon", "trail", "ciclismo", "automovilismo", "otra"]),
  competitionMode: z.enum(["individual", "teams"]),
  timingAggregation: z.enum(["single", "multiple"]),
  evaluationMethod: z.enum(["time", "points"]),
  scoringCriteria: z.string().optional().default(""),
  autoScoringRules: z.string().optional().default(""),
  isRelay: z.boolean().default(false),
  relayMeasurement: z.enum(["total", "perLeg"]),
  isMultiStage: z.boolean().default(false),
  includeInstancesInResult: z.boolean().default(false),
  instancesText: z.string().optional().default(""),
});

type RaceFormValues = z.infer<typeof raceSchema>;

export function RacesManager({ races }: { races: Race[] }) {
  const { toast } = useToast();
  const { role } = useContext(AppContext);
  const isAdmin = role === "admin";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<RaceFormValues>({
    resolver: zodResolver(raceSchema),
    defaultValues: {
      name: "",
      eventDate: new Date().toISOString().split("T")[0],
      ageCalculationMethod: "raceDay",
      discipline: "pedestrismo",
      competitionMode: "individual",
      timingAggregation: "single",
      evaluationMethod: "time",
      scoringCriteria: "",
      autoScoringRules: "",
      isRelay: false,
      relayMeasurement: "total",
      isMultiStage: false,
      includeInstancesInResult: false,
      instancesText: "",
    },
  });

  const sortedRaces = useMemo(
    () => [...races].sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    [races]
  );

  const evaluationMethod = form.watch("evaluationMethod");
  const isRelay = form.watch("isRelay");
  const isMultiStage = form.watch("isMultiStage");

  const handleOpen = (race?: Race) => {
    if (race) {
      setEditingRace(race);
      form.reset({
        name: race.name,
        eventDate: race.eventDate,
        ageCalculationMethod: race.ageCalculationMethod ?? "raceDay",
        discipline: race.discipline ?? "otra",
        competitionMode: race.competitionMode ?? "individual",
        timingAggregation: race.timingAggregation ?? "single",
        evaluationMethod: race.evaluationMethod ?? "time",
        scoringCriteria: race.scoringCriteria ?? "",
        autoScoringRules: race.autoScoringRules ?? "",
        isRelay: race.isRelay ?? false,
        relayMeasurement: race.relayMeasurement ?? "total",
        isMultiStage: race.isMultiStage ?? false,
        includeInstancesInResult: race.includeInstancesInResult ?? false,
        instancesText: (race.instances ?? []).map((i) => i.name).join("\n"),
      });
    } else {
      setEditingRace(null);
      form.reset({
        name: "",
        eventDate: new Date().toISOString().split("T")[0],
        ageCalculationMethod: "raceDay",
        discipline: "pedestrismo",
        competitionMode: "individual",
        timingAggregation: "single",
        evaluationMethod: "time",
        scoringCriteria: "",
        autoScoringRules: "",
        isRelay: false,
        relayMeasurement: "total",
        isMultiStage: false,
        includeInstancesInResult: false,
        instancesText: "",
      });
    }
    setDialogOpen(true);
  };

  const onSubmit = (values: RaceFormValues) => {
    startTransition(async () => {
      try {
        const instances = (values.instancesText || "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((name, index) => ({
            id: editingRace?.instances?.[index]?.id ?? nanoid(),
            name,
            includeInResult: values.includeInstancesInResult,
          }));

        const payload = {
          name: values.name,
          eventDate: values.eventDate,
          ageCalculationMethod: values.ageCalculationMethod,
          discipline: values.discipline,
          competitionMode: values.competitionMode,
          timingAggregation: values.timingAggregation,
          evaluationMethod: values.evaluationMethod,
          scoringCriteria: values.scoringCriteria?.trim() ?? "",
          autoScoringRules: values.autoScoringRules?.trim() ?? "",
          isRelay: values.isRelay,
          relayMeasurement: values.relayMeasurement,
          isMultiStage: values.isMultiStage && instances.length > 0,
          includeInstancesInResult: values.includeInstancesInResult && instances.length > 0,
          instances,
        } satisfies RaceInput;

        if (editingRace) {
          await updateRace(editingRace.id, payload);
          toast({ title: "Carrera actualizada", description: "Los datos se guardaron correctamente." });
        } else {
          await addRace(payload);
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
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Crea múltiples carreras y administra sus fechas oficiales."
              : "Consulta las carreras disponibles y abre sus detalles."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => handleOpen()} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Nueva carrera
          </Button>
        )}
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
                      {isAdmin && (
                        <>
                          <Button variant="outline" size="icon" onClick={() => handleOpen(race)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleDelete(race)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
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
              <div className="grid gap-4 sm:grid-cols-2">
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
                <FormField
                  control={form.control}
                  name="ageCalculationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calcular edad al</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Elige un método" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="raceDay">Día de la carrera</SelectItem>
                          <SelectItem value="endOfYear">Fin de año</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discipline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de carrera</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona la disciplina" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pedestrismo">Pedestrismo</SelectItem>
                          <SelectItem value="duatlon">Duatlón</SelectItem>
                          <SelectItem value="triatlon">Triatlón</SelectItem>
                          <SelectItem value="trail">Trail</SelectItem>
                          <SelectItem value="ciclismo">Ciclismo</SelectItem>
                          <SelectItem value="automovilismo">Automovilismo</SelectItem>
                          <SelectItem value="otra">Otra</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="competitionMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Formato</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Modalidad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="teams">Por equipos</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timingAggregation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tomas de tiempo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo de toma" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="single">Un solo día/toma</SelectItem>
                          <SelectItem value="multiple">Varias tomas/días (acumulado)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="evaluationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Criterio de evaluación</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Elegir" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="time">Por tiempo</SelectItem>
                          <SelectItem value="points">Por puntaje</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {evaluationMethod === "points" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="scoringCriteria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Criterios de puntaje</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Describe cómo se asignan puntos" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autoScoringRules"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reglas automáticas</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Condiciones para asignación automática" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="isRelay"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>¿Carrera por postas?</FormLabel>
                        <p className="text-sm text-muted-foreground">Indica si se mide por relevos.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="relayMeasurement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medición en postas</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!isRelay}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="total">Tiempo total</SelectItem>
                          <SelectItem value="perLeg">Tiempo por posta</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3 rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="isMultiStage"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>¿Varias instancias?</FormLabel>
                          <p className="text-sm text-muted-foreground">Nombra cada instancia o etapa.</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="includeInstancesInResult"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div>
                          <FormLabel>Contar instancias en el resultado</FormLabel>
                          <p className="text-sm text-muted-foreground">Define si se suman los tiempos de las etapas.</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!isMultiStage} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="instancesText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instancias (una por línea)</FormLabel>
                      <FormControl>
                        <Textarea placeholder={`Etapa 1\nEtapa 2`} {...field} disabled={!isMultiStage} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
