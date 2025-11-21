"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  Users,
  Timer,
  Settings,
  Shield,
  Eye,
  LogOut,
  LayoutGrid,
  CalendarIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RaceTimerProLogo } from "./icons";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { AppContext } from "@/context/app-context";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Toaster } from "./ui/toaster";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const navItems = [
  { href: "/", icon: Timer, label: "Cronómetro", roles: ["owner", "admin", "loader"] },
  { href: "/categories", icon: LayoutGrid, label: "Categorías", roles: ["owner", "admin"] },
  { href: "/live", icon: Eye, label: "Clasificación", roles: ["owner", "admin", "user"] },
];

function AppHeader() {
  const { role, raceDate, setRaceDate, ageCalculationMethod, setAgeCalculationMethod, user, logout } = React.useContext(AppContext);
  const { isMobile } = useSidebar();

  const pageTitles: { [key: string]: string } = {
    "/": "Cronómetro de Participantes",
    "/categories": "Administrar Categorías",
    "/live": "Clasificación en Tiempo Real",
    "/auth": "Acceso",
  };
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Panel";

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-2">
        {isMobile && <SidebarTrigger />}
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              <span>Ajustes de Carrera</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-4">
            <div className="space-y-4">
              <div>
                  <Label>Fecha de la Carrera</Label>
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button
                              variant={"outline"}
                              className={cn("w-full justify-start text-left font-normal", !raceDate && "text-muted-foreground")}
                          >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {raceDate ? format(raceDate, "PPP") : <span>Elige una fecha</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                          <Calendar
                              mode="single"
                              selected={raceDate}
                              onSelect={setRaceDate}
                              initialFocus
                          />
                      </PopoverContent>
                  </Popover>
              </div>
              <div>
                  <Label>Calcular Edad Al</Label>
                  <Select value={ageCalculationMethod} onValueChange={(value) => setAgeCalculationMethod(value as 'raceDay' | 'endOfYear')}>
                      <SelectTrigger>
                          <SelectValue placeholder="Método de cálculo" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="raceDay">Día de la carrera</SelectItem>
                          <SelectItem value="endOfYear">Final del año</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-3">
          <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Rol: {role === 'owner' ? 'Owner' : role === 'admin' ? 'Administrador' : role === 'loader' ? 'Cargador' : 'Usuario'}
          </div>
          <Separator orientation="vertical" className="h-8" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar>
                  <AvatarFallback>{user?.email?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.email ?? 'Invitado'}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isClient, setIsClient] = React.useState(false);
  const { role, authLoading, user } = React.useContext(AppContext);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if (!isClient || authLoading) return;

    if (!user && pathname !== "/auth") {
      router.replace("/auth");
      return;
    }

    if (!user) return;

    const allowedPaths: Record<string, string[]> = {
      owner: ["/", "/categories", "/live"],
      admin: ["/", "/categories", "/live"],
      loader: ["/"],
      user: ["/live"],
    };

    const path = pathname;
    const isAllowed = allowedPaths[role]?.some((allowed) => path.startsWith(allowed));
    if (!isAllowed) {
      const fallback = allowedPaths[role]?.[0] ?? "/live";
      router.replace(fallback);
    }
  }, [isClient, authLoading, pathname, role, user, router]);

  if (!isClient) {
    return null; // or a loading skeleton
  }

  const isStandalone = searchParams?.get("standalone") === "1";

  if (isStandalone) {
    return (
      <>
        <main className="min-h-screen bg-background">{children}</main>
        <Toaster />
      </>
    );
  }

  return (
      <>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2">
              <RaceTimerProLogo className="size-8" />
              <span className="text-lg font-semibold text-sidebar-foreground">
                LapTimer
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {navItems.filter(item => item.roles.includes(role)).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href}>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            {/* Footer content if any */}
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </SidebarInset>
        <Toaster />
      </>
  );
}
