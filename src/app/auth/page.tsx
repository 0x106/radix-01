// app/auth/page.tsx
"use client";

import Image from "next/image";
import Icon from "@/app/animated-icon.svg";
import { AuthForms } from "@/components/auth-forms"; // Import the new component

export default function AuthPage() {
  return (
    <div className="flex w-full min-h-screen flex-col items-center justify-center bg-[#fafafa] dark:bg-[#0a0a0a] p-4 text-center">
      <div className="w-fulla space-y-6 bg-white p-12 rounded-md shadow-2xl">
        <div className="space-y-2 ">
          <div className="flex items-center justify-center  mb-6">
            <Image width="36" height="36" src={Icon} alt="Logo" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Radix
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in to access your workspace.
          </p>
        </div>

        {/* Use the new AuthForms component */}
        <AuthForms variant="page" />
      </div>

      <div className="fixed bottom-6 text-xs text-slate-300 dark:text-slate-700 font-mono uppercase">
        built in london
      </div>
    </div>
  );
}
