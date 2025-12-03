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
} from "@/components/ui/sidebar";
import { Settings, LogOut, LayoutGrid, CalendarIcon, Shield } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { RaceTimerProLogo } from "./icons";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { AppContext } from "@/context/app-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Toaster } from "./ui/toaster";
import { Badge } from "./ui/badge";

const baseNavItems = [
  { href: "/", icon: LayoutGrid, label: "Dashboard" },
  { href: "/races", icon: CalendarIcon, label: "Carreras" },
];

function AppHeader() {
  const { role, user, signOut } = React.useContext(AppContext);
  const { isMobile } = useSidebar();

  const pageTitles: { [key: string]: string } = {
    "/": "Dashboard",
    "/races": "Carreras",
  };
  const pathname = usePathname();
  const title = pathname.startsWith("/races/")
    ? "Detalle de carrera"
    : pageTitles[pathname] ?? "Panel";

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-2">
        {isMobile && <SidebarTrigger />}
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant={role === "admin" ? "default" : "outline"}>{role}</Badge>
          {user?.email && <span className="text-sm text-muted-foreground">{user.email}</span>}
        </div>
        <Separator orientation="vertical" className="h-8" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar>
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = React.useContext(AppContext);
  
  const navItems = React.useMemo(() => {
    const items = [...baseNavItems];
    if (role === "admin") {
      items.push({ href: "/admin/users", icon: Shield, label: "Usuarios" });
    }
    return items;
  }, [role]);

  return (
    <>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <RaceTimerProLogo className="size-8" />
            <span className="text-lg font-semibold text-sidebar-foreground">
              RaceTimer Pro
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
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
