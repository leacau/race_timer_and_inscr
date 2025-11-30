"use client";

import { useContext, useMemo, useState, useTransition } from "react";
import { AppContext } from "@/context/app-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Role, UserProfile } from "@/lib/types";
import { updateUserRole } from "@/lib/actions";
import { toast } from "@/components/ui/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  client: "Cliente",
  timer: "Cronometrador",
  kit: "Entregador de kits",
  visitor: "Visitante",
  unassigned: "Sin rol",
};

export function UserAdmin({ initialUsers }: { initialUsers: UserProfile[] }) {
  const { role } = useContext(AppContext);
  const [users, setUsers] = useState(initialUsers);
  const [isPending, startTransition] = useTransition();

  const isAdmin = role === "admin";

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.email.localeCompare(b.email));
  }, [users]);

  const handleRoleChange = (userId: string, newRole: Role) => {
    startTransition(async () => {
      try {
        await updateUserRole(userId, newRole);
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
        toast({ title: "Rol actualizado" });
      } catch (error) {
        toast({ title: "No se pudo actualizar el rol", description: String(error) });
      }
    });
  };

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
            <CardDescription>Solo administradores pueden gestionar usuarios.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Asigna roles a los miembros de la organización.</p>
        </div>
        {isPending && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Roles y accesos</CardTitle>
          <CardDescription>Los nuevos usuarios comienzan sin rol hasta que se les asigne uno.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.displayName || "-"}</TableCell>
                    <TableCell>{user.provider || "email"}</TableCell>
                    <TableCell>
                      <Badge variant={user.entryType === "visitor" ? "secondary" : "outline"}>
                        {user.entryType === "visitor" ? "Visitante" : "Organización"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{roleLabels[user.role]}</Badge>
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.id, value as Role)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
