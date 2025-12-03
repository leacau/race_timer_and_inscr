"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import { AppContext } from "@/context/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShieldCheck } from "lucide-react";
import { loginWithEmail, loginWithGoogle, recordVisitor, registerWithEmail } from "@/lib/auth-client";
import { toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { role, setRole, entryType, setEntryType, user, setUser, authLoading } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("login");

  const needsEntrySelection = useMemo(() => !entryType, [entryType]);
  const isVisitorReady = entryType === "visitor" && role === "visitor" && user;
  const isOrganizationSigned = entryType === "organization" && !!user;

  useEffect(() => {
    if (entryType !== "visitor") return;
    if (role === "visitor" && user?.email) {
      return;
    }
    if (!email) return;
    setUser({ uid: null, email, role: "visitor", entryType: "visitor" });
    setRole("visitor");
  }, [entryType, role, user, email, setRole, setUser]);

  const handleVisitor = async () => {
    if (!email || !email.includes("@")) {
      toast({ title: "Ingresa un mail válido" });
      return;
    }
    setLoading(true);
    try {
      await recordVisitor(email);
      setUser({ uid: null, email, role: "visitor", entryType: "visitor" });
      setRole("visitor");
      setEntryType("visitor");
    } catch (error) {
      toast({ title: "No se pudo registrar el mail", description: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (mode: "login" | "register") => {
    if (!email || !password) {
      toast({ title: "Completa email y contraseña" });
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (error) {
      toast({ title: "No se pudo iniciar sesión", description: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      toast({ title: "No se pudo ingresar con Google", description: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const render = (content: React.ReactNode) => (
    <>
      {content}
      <Toaster />
    </>
  );

  if (authLoading) {
    return render(
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isVisitorReady || isOrganizationSigned) {
    return <>{children}</>;
  }

  if (needsEntrySelection) {
    return render(
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="grid gap-4 sm:grid-cols-2 w-full max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Parte de la organización</CardTitle>
              <CardDescription>Regístrate con email/clave o Google.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button onClick={() => setEntryType("organization")}>Continuar</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Público general / Corredor</CardTitle>
              <CardDescription>Solo necesitamos tu email para continuar.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button variant="secondary" onClick={() => setEntryType("visitor")}>Ingresar como visitante</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (entryType === "visitor") {
    return render(
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Ingresar como visitante</CardTitle>
            <CardDescription>Solo solicitamos tu email.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              placeholder="tuemail@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />
            <Button onClick={handleVisitor} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return render(
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Acceso para organización</CardTitle>
          <CardDescription>
            Inicia sesión o regístrate. El administrador asignará tu rol dentro de la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="register">Crear cuenta</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="space-y-4 pt-4">
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                placeholder="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button className="w-full" disabled={loading} onClick={() => handleEmailAuth("login")}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ingresar
              </Button>
            </TabsContent>
            <TabsContent value="register" className="space-y-4 pt-4">
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                placeholder="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button className="w-full" disabled={loading} onClick={() => handleEmailAuth("register")}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Registrarme
              </Button>
            </TabsContent>
          </Tabs>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Separator className="flex-1" />
            <span>o continúa con</span>
            <Separator className="flex-1" />
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
