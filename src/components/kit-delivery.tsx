"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeftRightIcon, SearchIcon, TruckIcon } from "lucide-react";

import type { Category, Participant, Race } from "@/lib/types";
import { assignCategory } from "@/lib/logic";
import { AppContext } from "@/context/app-context";
import { toggleKitDelivered, replaceParticipant } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const replacementSchema = z.object({
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
  isSpecial: z.boolean().optional(),
});

type ReplacementValues = z.infer<typeof replacementSchema>;

type KitDeliveryProps = {
  race: Race;
  participants: Participant[];
  categories: Category[];
};

export function KitDelivery({ race, participants, categories }: KitDeliveryProps) {
  const { raceDate, ageCalculationMethod, setRaceDate, setAgeCalculationMethod, role } = useContext(AppContext);
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState<Participant[]>(participants);
  const [selected, setSelected] = useState<Participant | null>(null);
  const [isReplacementOpen, setIsReplacementOpen] = useState(false);
  const [localParticipants, setLocalParticipants] = useState<Participant[]>(participants);
  const isAdmin = role === "admin";
  const isRaceLocked = Boolean(race.finalized) && !isAdmin;

  useEffect(() => {
    if (race.eventDate) {
      setRaceDate(new Date(race.eventDate));
    }
    if (race.ageCalculationMethod) {
      setAgeCalculationMethod(race.ageCalculationMethod);
    }
  }, [race, setAgeCalculationMethod, setRaceDate]);

  useEffect(() => {
    setLocalParticipants(participants);
  }, [participants]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setFiltered([]);
      return;
    }
    const term = query.trim().toLowerCase();
    setFiltered(
      localParticipants.filter((p) => {
        return (
          p.dni.toLowerCase().includes(term) ||
          p.surname.toLowerCase().includes(term) ||
          p.name.toLowerCase().includes(term)
        );
      })
    );
  }, [query, localParticipants]);

  const categoryMap = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = category.name;
      return acc;
    }, {} as Record<string, string>);
  }, [categories]);

  const form = useForm<ReplacementValues>({
    resolver: zodResolver(replacementSchema),
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

  const resetReplacementForm = (participant: Participant) => {
    form.reset({
      bibNumber: participant.bibNumber,
      name: participant.name,
      surname: participant.surname,
      dni: participant.dni,
      birthDate: participant.birthDate,
      gender: participant.gender,
      distance: participant.distance,
      city: participant.city ?? "",
      province: participant.province ?? "",
      country: participant.country ?? "",
      isSpecial: participant.isSpecial,
    });
  };

  const handleToggleDelivered = async (participant: Participant, delivered: boolean) => {
    if (isRaceLocked) {
      toast({
        variant: "destructive",
        title: "Carrera finalizada",
        description: "No puedes registrar entregas en una carrera cerrada.",
      });
      return;
    }
    if (participant.replacedById) {
      toast({
        variant: "destructive",
        title: "Acción no permitida",
        description: "No puedes actualizar el kit de un participante que fue reemplazado.",
      });
      return;
    }
    try {
      await toggleKitDelivered(participant.id, delivered, race.id);
      setLocalParticipants((prev) =>
        prev.map((p) => (p.id === participant.id ? { ...p, kitDelivered: delivered } : p))
      );
      setSelected((current) => (current && current.id === participant.id ? { ...current, kitDelivered: delivered } : current));
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "No se pudo actualizar", description: "Intenta nuevamente." });
    }
  };

  const handleReplacementSubmit = form.handleSubmit(async (values) => {
    if (isRaceLocked) {
      toast({
        variant: "destructive",
        title: "Carrera finalizada",
        description: "No puedes registrar cambios en una carrera cerrada.",
      });
      return;
    }
    if (!selected) return;
    try {
      const { newParticipantId } = await replaceParticipant(
        selected.id,
        values,
        raceDate,
        ageCalculationMethod,
        race.id
      );
      const nextCategory = assignCategory(values, categories, raceDate, ageCalculationMethod);
      const newParticipant: Participant = {
        id: newParticipantId,
        raceId: race.id,
        bibNumber: selected.bibNumber,
        chipNumber: selected.chipNumber,
        name: values.name,
        surname: values.surname,
        dni: values.dni,
        gender: values.gender,
        distance: values.distance,
        birthDate: values.birthDate,
        categoryId: nextCategory,
        startTime: selected.startTime,
        finishTime: selected.finishTime,
        city: values.city || null,
        province: values.province || null,
        country: values.country || null,
        isSpecial: Boolean(values.isSpecial),
        kitDelivered: selected.kitDelivered ?? false,
        replacedFromId: selected.id,
        replacedById: null,
      };

      setLocalParticipants((prev) => {
        const updatedOriginal = prev.map((p) =>
          p.id === selected.id ? { ...p, replacedById: newParticipantId } : p
        );
        return [...updatedOriginal, newParticipant];
      });
      setSelected(newParticipant);
      toast({ title: "Cambio registrado", description: "El corredor fue reemplazado y mantiene su dorsal y chip." });
      setIsReplacementOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "No se pudo reemplazar", description: "Revisa los datos e intenta nuevamente." });
    }
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Entrega de kits - {race.name}</h1>
        <p className="text-muted-foreground">Busca participantes por DNI, apellido o nombre (mínimo 3 caracteres).</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Búsqueda de participantes</CardTitle>
            <CardDescription>Filtra automáticamente desde el tercer caracter.</CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1">
            <TruckIcon className="h-4 w-4" /> Kits
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <SearchIcon className="h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por DNI, apellido o nombre"
            />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dorsal</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Distancia</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Kit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {query.trim().length < 3 ? "Escribe al menos 3 caracteres para buscar" : "Sin resultados"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((participant) => {
                    const isReplaced = Boolean(participant.replacedById);
                    return (
                      <TableRow
                        key={participant.id}
                        className={isReplaced ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                        onClick={() => {
                          if (isReplaced) return;
                          setSelected(participant);
                          resetReplacementForm(participant);
                        }}
                      >
                        <TableCell className="font-semibold">
                          <div className="flex items-center gap-2">
                            <span>{participant.bibNumber}</span>
                            {isReplaced && <Badge variant="outline">Reemplazado</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{`${participant.name} ${participant.surname}`}</TableCell>
                        <TableCell>{participant.dni}</TableCell>
                        <TableCell>{participant.distance}</TableCell>
                        <TableCell>
                          {participant.categoryId ? (
                            <Badge variant="secondary">{categoryMap[participant.categoryId] || "Sin categoría"}</Badge>
                          ) : (
                            <Badge variant="outline">Sin categoría</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {participant.kitDelivered ? (
                            <Badge variant="default">Entregado</Badge>
                          ) : (
                            <Badge variant="outline">Pendiente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalle del participante</DialogTitle>
            <DialogDescription>Actualiza la entrega de kit o registra un cambio de corredor.</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Dorsal</p>
                  <p className="text-lg font-semibold">#{selected.bibNumber}</p>
                  <p className="text-sm text-muted-foreground">Chip: {selected.chipNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="text-lg font-semibold">{`${selected.name} ${selected.surname}`}</p>
                  <p className="text-sm text-muted-foreground">DNI: {selected.dni}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Distancia</p>
                  <p className="font-medium">{selected.distance}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Categoría</p>
                  <p className="font-medium">
                    {selected.categoryId ? categoryMap[selected.categoryId] || "Sin categoría" : "Sin categoría"}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Kit entregado</p>
                  <p className="text-xs text-muted-foreground">Marca cuando el corredor retire su kit.</p>
                </div>
                <Switch
                  checked={Boolean(selected.kitDelivered)}
                  onCheckedChange={(checked) => handleToggleDelivered(selected, checked)}
                  disabled={Boolean(selected.replacedById) || isRaceLocked}
                  aria-label="Kit entregado"
                />
              </div>

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setIsReplacementOpen(true)}
                disabled={Boolean(selected.replacedById) || isRaceLocked}
              >
                <ArrowLeftRightIcon className="mr-2 h-4 w-4" /> Cambio de corredor
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReplacementOpen} onOpenChange={setIsReplacementOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Registrar cambio de corredor</DialogTitle>
            <DialogDescription>
              El nuevo corredor usará el mismo dorsal y chip. La categoría se recalcula automáticamente.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={handleReplacementSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bibNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dorsal</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <Label>Chip</Label>
                  <Input value={selected?.chipNumber ?? ""} disabled />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dni"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DNI</FormLabel>
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
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Género</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
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
                  name="distance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Distancia</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
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
                <FormField
                  control={form.control}
                  name="isSpecial"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-1">
                        <FormLabel className="font-medium">Categoría especial</FormLabel>
                        <p className="text-xs text-muted-foreground">Marca si el corredor es especial.</p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
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
              </div>

              <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setIsReplacementOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <ArrowLeftRightIcon className="mr-2 h-4 w-4" /> Guardar cambio
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
