"use client";

import type { ResumeContent } from "@/lib/types";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ContentProvider } from "@/components/providers/ContentProvider";
import { EditorProvider } from "@/components/providers/EditorProvider";
import Header from "@/components/Header";
import Hero from "@/components/sections/Hero";
import Experience from "@/components/sections/Experience";
import Projects from "@/components/sections/Projects";
import SkyWords from "@/components/paper/SkyWords";
import Skills from "@/components/sections/Skills";
import Education from "@/components/sections/Education";
import Contact from "@/components/sections/Contact";
import EditPanel from "@/components/editor/EditPanel";
import Modals from "@/components/modals/Modals";
import DarkSky from "@/components/space/DarkSky";
import { PaperDefs, PaperSky } from "@/components/paper/Paper";
import { IntroProvider } from "@/components/intro/IntroProvider";

export default function App({ initial }: { initial: ResumeContent }) {
  return (
    <AuthProvider>
      <EditorProvider>
        <ContentProvider initial={initial}>
          {/* Wraps the page so the header's replay button can reach the
              intro, which renders on top of everything else. */}
          <IntroProvider>
            {/* Dark theme: the GPU sky (DarkSky). Light theme: the paper sky. */}
            <PaperDefs />
            <PaperSky />
            {/* Dark theme: the focus keywords written faintly into space,
                under the galaxy canvas so the stars and the black hole are
                drawn over them. (The light theme draws them inside the
                paper sky, below the clouds.) */}
            <div aria-hidden className="pointer-events-none fixed inset-0 z-0 [.light_&]:hidden">
              <SkyWords theme="dark" />
            </div>
            <DarkSky />
            <div className="relative z-10">
              <Header />
              <main>
                <Hero />
                <Experience />
                <Projects />
                <Skills />
                <Education />
                <Contact />
              </main>
              <EditPanel />
              <Modals />
            </div>
          </IntroProvider>
        </ContentProvider>
      </EditorProvider>
    </AuthProvider>
  );
}
