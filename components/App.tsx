"use client";

import type { ResumeContent } from "@/lib/types";
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider";
import { ContentProvider } from "@/components/providers/ContentProvider";
import { EditorProvider } from "@/components/providers/EditorProvider";
import LoginGate from "@/components/LoginGate";
import Header from "@/components/Header";
import Hero from "@/components/sections/Hero";
import Experience from "@/components/sections/Experience";
import Skills from "@/components/sections/Skills";
import Education from "@/components/sections/Education";
import Contact from "@/components/sections/Contact";
import EditPanel from "@/components/editor/EditPanel";

function Site() {
  const { authed } = useAuth();

  if (!authed) return <LoginGate />;

  return (
    <div className="relative">
      <Header />
      <main>
        <Hero />
        <Experience />
        <Skills />
        <Education />
        <Contact />
      </main>
      <EditPanel />
    </div>
  );
}

export default function App({ initial }: { initial: ResumeContent }) {
  return (
    <AuthProvider>
      <ContentProvider initial={initial}>
        <EditorProvider>
          <Site />
        </EditorProvider>
      </ContentProvider>
    </AuthProvider>
  );
}
