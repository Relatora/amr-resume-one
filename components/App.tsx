"use client";

import type { ResumeContent } from "@/lib/types";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ContentProvider } from "@/components/providers/ContentProvider";
import { EditorProvider } from "@/components/providers/EditorProvider";
import Header from "@/components/Header";
import Hero from "@/components/sections/Hero";
import Experience from "@/components/sections/Experience";
import Skills from "@/components/sections/Skills";
import Education from "@/components/sections/Education";
import Contact from "@/components/sections/Contact";
import EditPanel from "@/components/editor/EditPanel";
import Modals from "@/components/modals/Modals";
import Galaxy from "@/components/Galaxy";

export default function App({ initial }: { initial: ResumeContent }) {
  return (
    <AuthProvider>
      <EditorProvider>
        <ContentProvider initial={initial}>
          <Galaxy />
          <div className="relative z-10">
            <Header />
            <main>
              <Hero />
              <Experience />
              <Skills />
              <Education />
              <Contact />
            </main>
            <EditPanel />
            <Modals />
          </div>
        </ContentProvider>
      </EditorProvider>
    </AuthProvider>
  );
}
