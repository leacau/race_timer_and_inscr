"use client";

import { useState, useContext } from "react";
import { Plus, Edit, Trash2, MoreVertical } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
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
  DialogTrigger,
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
import { addCategory, updateCategory, deleteCategory } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { AppContext } from "@/context/app-context";

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Category name is required"),
  minAge: z.coerce.number().int().min(0),
  maxAge: z.coerce.number().int().min(0),
  gender: z.enum(["Any", "Male", "Female", "Other"]),
  distance: z.enum(["5k", "10k", "21k", "42k"]),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const { toast } = useToast();
  const { role } = useContext(AppContext);
  const [open, setOpen] = useState(false);
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

  const onSubmit = async (values: CategoryFormValues) => {
    try {
      if (editingCategory) {
        await updateCategory({ ...editingCategory, ...values });
        toast({ title: "Category Updated", description: "The category has been successfully updated." });
      } else {
        await addCategory(values);
        toast({ title: "Category Added", description: "The new category has been successfully added." });
      }
      setOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save the category.",
      });
    }
  };
  
  const handleDelete = async (id: string) => {
    try {
        await deleteCategory(id);
        toast({ title: "Category Deleted", description: "The category has been successfully deleted." });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to delete the category.",
        });
    }
  };

  const isAdmin = role === 'admin';

  return (
    <>
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
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(category.id)}>
                            <Trash2 className="mr-2 h-4 w-4"/>
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>Age: {category.minAge} - {category.maxAge}</p>
                <p>Gender: {category.gender}</p>
                <p>Distance: {category.distance}</p>
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
                <span className="mt-2 font-medium">Add New Category</span>
            </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add New Category"}</DialogTitle>
            <DialogDescription>
              {editingCategory ? "Update the details for this category." : "Define a new category for the race."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Men 30-39 10k" {...field} />
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
                      <FormLabel>Min Age</FormLabel>
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
                      <FormLabel>Max Age</FormLabel>
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
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Any">Any</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
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
                    <FormLabel>Distance</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select distance" />
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
                  <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                <Button type="submit" variant="default">Save Category</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
