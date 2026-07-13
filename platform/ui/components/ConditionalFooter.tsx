"use client";
import { usePathname } from "next/navigation";
import LeluFooter from "./LeluFooter";

const HIDE_ON = ["/", "/demo", "/login", "/register"];

export function ConditionalFooter() {
  const pathname = usePathname();
  if (HIDE_ON.includes(pathname)) return null;
  return (
    <div className="flex flex-col items-center w-full px-5 sm:px-10">
      <div className="max-w-7xl w-full">
        <LeluFooter />
      </div>
    </div>
  );
}
