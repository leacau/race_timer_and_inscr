"use client";

import { useMemo, useState, useTransition } from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { Participant, Race } from "@/lib/types";
import { addParticipant } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const registrationSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  surname: z.string().min(1, "Apellido requerido"),
  dni: z.string().min(1, "DNI requerido"),
  distance: z.string().min(1, "Selecciona una distancia"),
  gender: z.enum(["Male", "Female", "Other"]),
  birthDate: z.string().min(1, "Fecha de nacimiento requerida"),
  bibNumber: z.string().optional(),
  isSpecial: z.boolean().optional(),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

export function RegistrationDesk({
  participants,
  race,
}: {
  participants: Participant[];
  race: Race;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      name: "",
      surname: "",
      dni: "",
      distance: race.distances?.[0] ?? "",
      gender: "Male",
      birthDate: "",
      bibNumber: "",
      isSpecial: false,
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return participants;
    return participants.filter((participant) => {
      const haystack = [
        participant.dni,
        participant.name,
        participant.surname,
        participant.bibNumber ?? "",
        participant.chipNumber ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [participants, search]);

  const selected = useMemo(
    () => filtered.find((p) => p.id === selectedId) ?? filtered[0],
    [filtered, selectedId]
  );

  const handleSubmit = (values: RegistrationFormValues) => {
    startTransition(async () => {
      try {
        await addParticipant(
          {
            ...values,
            bibNumber: values.bibNumber?.trim() || null,
            isSpecial: Boolean(values.isSpecial),
          },
          new Date(race.eventDate),
          race.ageCalculationMethod,
          race.id
        );
        toast({ title: "Participante guardado", description: "La inscripción fue registrada correctamente." });
        form.reset({
          name: "",
          surname: "",
          dni: "",
          distance: race.distances?.[0] ?? "",
          gender: "Male",
          birthDate: "",
          bibNumber: "",
          isSpecial: false,
        });
        router.refresh();
      } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la inscripción." });
      }
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="h-full">
        <CardHeader className="space-y-2">
          <CardTitle>Búsqueda rápida</CardTitle>
          <CardDescription>Busca por DNI, apellido o nombre. Selecciona un resultado para ver su ficha.</CardDescription>
          {!race.registrationsOpen && (
            <Badge variant="destructive" className="w-fit">Inscripciones cerradas</Badge>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder="DNI, apellido o nombre"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:max-w-xs"
            />
            <span className="text-sm text-muted-foreground">{filtered.length} coincidencia(s)</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-[360px] rounded-md border">
            <div className="divide-y">
              {filtered.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No se encontraron participantes con ese criterio.</p>
              )}
              {filtered.map((participant) => (
                <button
                  key={participant.id}
                  onClick={() => setSelectedId(participant.id)}
                  className={`flex w-full items-start justify-between gap-4 p-4 text-left hover:bg-accent ${
                    selected?.id === participant.id ? "bg-accent" : ""
                  }`}
                >
                  <div>
                    <p className="font-semibold">{participant.surname}, {participant.name}</p>
                    <p className="text-sm text-muted-foreground">DNI {participant.dni}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{participant.distance?.toUpperCase()}</p>
                    <p>{participant.gender === "Male" ? "M" : participant.gender === "Female" ? "F" : "Otro"}</p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          {selected && (
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-muted-foreground">Ficha seleccionada</p>
                  <p className="text-lg font-semibold">{selected.surname}, {selected.name}</p>
                </div>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  {selected.bibNumber && <Badge variant="outline">Dorsal {selected.bibNumber}</Badge>}
                  {selected.chipNumber && <Badge variant="outline">Chip {selected.chipNumber}</Badge>}
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <div>
                  <Label className="text-xs uppercase">DNI</Label>
                  <p className="text-foreground">{selected.dni}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase">Distancia</Label>
                  <p className="text-foreground">{selected.distance}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase">Género</Label>
                  <p className="text-foreground">{selected.gender === "Male" ? "Masculino" : selected.gender === "Female" ? "Femenino" : "Otro"}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase">Nacimiento</Label>
                  <p className="text-foreground">{selected.birthDate}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase">Especial</Label>
                  <p className="text-foreground">{selected.isSpecial ? "Sí" : "No"}</p>
                </div>
                {selected.city && (
                  <div>
                    <Label className="text-xs uppercase">Ciudad</Label>
                    <p className="text-foreground">{selected.city}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardHeader>
          <CardTitle>Registrar inscripción</CardTitle>
          <CardDescription>Agrega un nuevo corredor directamente desde el puesto de acreditación.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="surname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input placeholder="Apellido" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI</FormLabel>
                      <FormControl>
                        <Input placeholder="Documento" {...field} />
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
                      <FormLabel>Fecha de nacimiento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="distance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distancia</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {race.distances?.map((distance) => (
                            <SelectItem key={distance} value={distance}>
                              {distance.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Género</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
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
                  name="bibNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dorsal (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 120" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center gap-2 rounded-md border p-3">
                <FormField
                  control={form.control}
                  name="isSpecial"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div>
                        <FormLabel>Marca categoría especial</FormLabel>
                        <p className="text-xs text-muted-foreground">Para participantes con necesidades especiales.</p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={isPending || !race.registrationsOpen} className="w-full sm:w-auto">
                {race.registrationsOpen ? "Guardar inscripción" : "Inscripciones cerradas"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

