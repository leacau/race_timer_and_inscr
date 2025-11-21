"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, LogIn, UserPlus, ShieldCheck } from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const ensureUserRole = async (uid: string) => {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { role: "user" }, { merge: true });
    }
  };

  const redirectByRole = async (uid: string) => {
    if (!uid) {
      router.replace("/live");
      return;
    }
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    const role = (snap.data()?.role as string) ?? "user";
    if (role === "user") {
      router.replace("/live");
    } else {
      router.replace("/");
    }
  };

  const handleEmailSignIn = async () => {
    try {
      setIsLoading(true);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserRole(credential.user.uid);
      await redirectByRole(credential.user.uid);
      toast({ title: "Bienvenido", description: "Sesión iniciada con éxito." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo iniciar sesión." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailRegister = async () => {
    try {
      setIsLoading(true);
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", credential.user.uid), { role: "user" }, { merge: true });
      await redirectByRole(credential.user.uid);
      toast({ title: "Cuenta creada", description: "Te asignamos el rol de usuario por defecto." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo registrar." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserRole(result.user.uid);
      await redirectByRole(result.user.uid);
      toast({ title: "Bienvenido", description: "Sesión iniciada con Google." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo iniciar sesión con Google." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-medium">Acceso LapTimer</span>
          </div>
          <CardTitle className="text-2xl">Identifícate</CardTitle>
          <CardDescription>Inicia sesión o crea tu cuenta para continuar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Ingresar</TabsTrigger>
              <TabsTrigger value="register">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email-login">Email</Label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email-login"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="border-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-login">Contraseña</Label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password-login"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="border-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleEmailSignIn} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                Ingresar
              </Button>
              <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continuar con Google
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email-register">Email</Label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email-register"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="border-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-register">Contraseña</Label>
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password-register"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="border-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <Button className="w-full" onClick={handleEmailRegister} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Crear cuenta y entrar
              </Button>
              <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Registrarse con Google
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
