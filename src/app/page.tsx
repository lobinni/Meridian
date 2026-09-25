"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import CaseFeed from "@/components/CaseFeed";
import CaseDetail from "@/components/CaseDetail";
import FileCaseModal from "@/components/FileCaseModal";
import Leaderboard from "@/components/Leaderboard";
import BetHistory from "@/components/BetHistory";
import Footer from "@/components/Footer";
import { useCases, useStats } from "@/lib/hooks/useMeridianTribunal";

export default function HomePage() {
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [fileOpen, setFileOpen] = useState(false);

  const { data: cases } = useCases();
  const stats = useStats(cases);

  return (
    <main>
      <Navbar />
      <Hero stats={stats} onFileCase={() => setFileOpen(true)} />
      <CaseFeed
        stats={stats}
        onSelectCase={(id) => setSelectedCaseId(id)}
        onFileCase={() => setFileOpen(true)}
      />
      <Leaderboard cases={cases} onSelectCase={(id) => setSelectedCaseId(id)} />
      <BetHistory onSelectCase={(id) => setSelectedCaseId(id)} />
      <Footer />

      <CaseDetail caseId={selectedCaseId} onClose={() => setSelectedCaseId(null)} />
      <FileCaseModal
        open={fileOpen}
        onOpenChange={setFileOpen}
        onFiled={(id) => setSelectedCaseId(id)}
      />
    </main>
  );
}
