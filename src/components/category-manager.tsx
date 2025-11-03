"use client";

import { useState, useContext } from "react";
import { Plus, Edit, Trash2, MoreVertical, Sparkles } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Category } from "@/lib/types";
import { addCategory, updateCategory, deleteCategory, bulkAddCategories } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { AppContext } from "@/context/app-context";
import { Checkbox } from "./ui/checkbox";

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "El nombre de la categoría es requerido"),
  minAge: z.coerce.number().int().min(0),
  maxAge: z.coerce.number().int().min(0),
  gender: z.enum(["Any", "Male", "Female", "Other"]),
  distance: z.enum(["5k", "10k", "21k", "42k"]),
});

const bulkCategorySchema = z.object({
  ageRanges: z.array(z.object({
    min: z.coerce.number().int().min(0),
    max: z.coerce.number().int().min(0),
  })).min(1, "Debe definir al menos un rango de edad."),
  distances: z.array(z.string()).min(1, "Debe seleccionar al menos una distancia."),
  genders: z.array(z.string()).min(1, "Debe seleccionar al menos un género."),
});


type CategoryFormValues = z.infer<typeof categorySchema>;
type BulkCategoryFormValues = z.infer<typeof bulkCategorySchema>;


export function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const { toast } = useToast();
  const { role } = useContext(AppContext);
  const [open, setOpen] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      minAge: 0,
      maxAge: 99,
      gender: "Any",
      distance: "5k",
    },
  });

  const bulkForm = useForm<BulkCategoryFormValues>({
    resolver: zodResolver(bulkCategorySchema),
    defaultValues: {
      ageRanges: [{min: 18, max: 29}],
      distances: [],
      genders: [],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: bulkForm.control,
    name: "ageRanges"
  });

  const handleOpenDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      form.reset(category);
    } else {
      setEditingCategory(null);
      form.reset({
        name: "",
        minAge: 0,
        maxAge: 99,
        gender: "Any",
        distance: "5k",
      });
    }
    setOpen(true);
  };
  
  const handleOpenBulkDialog = () => {
    bulkForm.reset({
      ageRanges: [{min: 18, max: 29}],
      distances: [],
      genders: [],
    });
    setOpenBulk(true);
  }

  const onSubmit = async (values: CategoryFormValues) => {
    try {
      if (editingCategory) {
        await updateCategory({ ...editingCategory, ...values });
        toast({ title: "Categoría Actualizada", description: "La categoría ha sido actualizada correctamente." });
      } else {
        await addCategory(values);
        toast({ title: "Categoría Añadida", description: "La nueva categoría ha sido añadida correctamente." });
      }
      setOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar la categoría.",
      });
    }
  };
  
  const onBulkSubmit = async (values: BulkCategoryFormValues) => {
    try {
      await bulkAddCategories(values);
      toast({ title: "Categorías Creadas", description: "Las categorías han sido creadas masivamente." });
      setOpenBulk(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron crear las categorías.",
      });
    }
  }

  const handleDelete = async (id: string) => {
    try {
        await deleteCategory(id);
        toast({ title: "Categoría Eliminada", description: "La categoría ha sido eliminada correctamente." });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo eliminar la categoría.",
        });
    }
  };

  const isAdmin = role === 'admin';
  const distancesOptions = ["5k", "10k", "21k", "42k"];
  const gendersOptions = [
    { id: "Male", label: "Masculino" },
    { id: "Female", label: "Femenino" },
  ];

  return (
    <>
      <div className="flex justify-end mb-4">
        {isAdmin && (
            <Button onClick={handleOpenBulkDialog}>
                <Sparkles className="mr-2 h-4 w-4"/>
                Creador Masivo de Categorías
            </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {initialCategories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">{category.name}</CardTitle>
              {isAdmin && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDialog(category)}>
                            <Edit className="mr-2 h-4 w-4"/>
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(category.id)}>
                            <Trash2 className="mr-2 h-4 w-4"/>
                            Eliminar
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>Edad: {category.minAge} - {category.maxAge}</p>
                <p>Género: {category.gender === 'Any' ? 'Cualquiera' : category.gender === 'Male' ? 'Masculino' : category.gender === 'Female' ? 'Femenino' : 'Otro'}</p>
                <p>Distancia: {category.distance}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {isAdmin && (
            <button
                onClick={() => handleOpenDialog()}
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
                <Plus className="h-10 w-10" />
                <span className="mt-2 font-medium">Añadir Nueva Categoría</span>
            </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar Categoría" : "Añadir Nueva Categoría"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Actualiza los detalles de esta categoría." : "Define una nueva categoría para la carrera."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Categoría</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Hombres 30-39 10k" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minAge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Edad Mín.</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxAge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Edad Máx.</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Género</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar género" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Any">Cualquiera</SelectItem>
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
                          <SelectValue placeholder="Seleccionar distancia" />
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
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">Cancelar</Button>
                </DialogClose>
                <Button type="submit" variant="default">Guardar Categoría</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={openBulk} onOpenChange={setOpenBulk}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Creador Masivo de Categorías</DialogTitle>
            <DialogDescription>
                Crea múltiples categorías a la vez definiendo rangos de edad, distancias y géneros.
            </DialogDescription>
          </DialogHeader>
          <Form {...bulkForm}>
            <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-6">
                <div>
                    <FormLabel>Rangos de Edad</FormLabel>
                    <div className="mt-2 space-y-2">
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex items-center gap-2">
                                <FormField
                                    control={bulkForm.control}
                                    name={`ageRanges.${index}.min`}
                                    render={({ field }) => (
                                        <FormItem className="flex-1"><FormControl><Input type="number" placeholder="Mín" {...field}/></FormControl><FormMessage/></FormItem>
                                    )}
                                />
                                <span>-</span>
                                <FormField
                                    control={bulkForm.control}
                                    name={`ageRanges.${index}.max`}
                                    render={({ field }) => (
                                        <FormItem className="flex-1"><FormControl><Input type="number" placeholder="Máx" {...field}/></FormControl><FormMessage/></FormItem>
                                    )}
                                />
                                <Button type="button" variant="outline" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                            </div>
                        ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({min: 0, max: 99})}>
                        <Plus className="mr-2 h-4 w-4"/> Añadir Rango
                    </Button>
                    <FormMessage>{bulkForm.formState.errors.ageRanges?.message}</FormMessage>
                </div>
                
                <FormField
                    control={bulkForm.control}
                    name="distances"
                    render={() => (
                        <FormItem>
                            <FormLabel>Distancias</FormLabel>
                            <div className="flex flex-wrap gap-4 mt-2">
                                {distancesOptions.map(distance => (
                                    <FormField
                                        key={distance}
                                        control={bulkForm.control}
                                        name="distances"
                                        render={({field}) => (
                                            <FormItem key={distance} className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(distance)}
                                                        onCheckedChange={(checked) => {
                                                          return checked
                                                            ? field.onChange([...field.value, distance])
                                                            : field.onChange(field.value?.filter(v => v !== distance))
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">{distance}</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <FormField
                    control={bulkForm.control}
                    name="genders"
                    render={() => (
                        <FormItem>
                            <FormLabel>Géneros</FormLabel>
                            <div className="flex flex-wrap gap-4 mt-2">
                                {gendersOptions.map(gender => (
                                    <FormField
                                        key={gender.id}
                                        control={bulkForm.control}
                                        name="genders"
                                        render={({field}) => (
                                            <FormItem key={gender.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(gender.id)}
                                                        onCheckedChange={(checked) => {
                                                          return checked
                                                            ? field.onChange([...field.value, gender.id])
                                                            : field.onChange(field.value?.filter(v => v !== gender.id))
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormLabel className="font-normal">{gender.label}</FormLabel>
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancelar</Button></DialogClose>
                    <Button type="submit">Crear Categorías</Button>
                </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
