import Link from "next/link";

export const metadata = {
  title: "Developer | Goonginga League",
  description: "Meet the developer and learn about the technology behind the Goonginga League platform.",
};

export default function DevPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header with decorative elements */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:40px_40px] opacity-50" />
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-teal-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-20 right-1/4 w-60 h-60 bg-cyan-500/10 rounded-full blur-[80px]" />
        
        <div className="container mx-auto px-4 py-16 relative">
          {/* Developer Introduction */}
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-8 mb-16">
              {/* Profile Picture */}
              <div className="relative">
                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 p-1">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
                    <svg className="w-20 h-20 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute -right-2 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 bg-white border-2 border-teal-400 rounded-full" />
                </div>
              </div>
              
              {/* Introduction Text */}
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 border border-teal-200 rounded-full text-teal-700 text-sm mb-4">
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                  Developer
                </div>
                <h1 className="text-4xl font-bold text-slate-900 mb-4">
                  Hi! I&apos;m the Developer
                </h1>
                <p className="text-lg text-slate-600 leading-relaxed">
                  I built this platform to bring the competitive Overwatch community together. 
                  The Goonginga League is powered by a robust tournament management system with 
                  real-time draft phases, intelligent stat tracking with OCR, and a complete 
                  match lifecycle engine. Let me walk you through how it all works.
                </p>
              </div>
            </div>

            {/* Decorative divider */}
            <div className="flex items-center justify-center gap-4 mb-16">
              <div className="h-px w-20 bg-gradient-to-r from-transparent to-slate-300" />
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-teal-400 rounded-full" />
                <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                <div className="w-2 h-2 bg-teal-400 rounded-full" />
              </div>
              <div className="h-px w-20 bg-gradient-to-l from-transparent to-slate-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-20">
        <div className="max-w-4xl mx-auto space-y-12">

          {/* Draft System Flow Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Draft System Flow</h2>
                  <p className="text-white/80">Complete match lifecycle with map picks and hero bans</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-slate-600 leading-relaxed">
                The draft system is a state machine that manages the entire competitive match flow, from map selection 
                through hero bans. Each match cycles through multiple games (Best-of-3 or Best-of-5), with each game 
                following a structured draft phase before play begins.
              </p>

              {/* State Machine Diagram */}
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                <h3 className="font-semibold text-slate-900 mb-4">Draft Phase State Machine</h3>
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                  <div className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-mono">STARTING</div>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg font-mono">MAPPICKING</div>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="px-3 py-2 bg-red-100 text-red-700 rounded-lg font-mono">BAN</div>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="px-3 py-2 bg-teal-100 text-teal-700 rounded-lg font-mono">ENDMAP</div>
                  <svg className="w-4 h-4 text-slate-400 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="px-3 py-2 bg-green-100 text-green-700 rounded-lg font-mono hidden md:block">FINISHED</div>
                </div>
                <p className="text-xs text-slate-500 mt-3 text-center">
                  After ENDMAP, the cycle returns to MAPPICKING for the next game until match completion
                </p>
              </div>

              {/* Phase Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Phase-by-Phase Breakdown</h3>
                
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center">
                      <span className="text-slate-600 font-bold text-xs">1</span>
                    </div>
                    <h4 className="font-semibold text-slate-900">STARTING Phase</h4>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    The draft is created and awaits manager activation. The system determines which team picks first based on match type:
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-4">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2" />
                      <span><strong>Playoffs/Semifinals/Finals:</strong> Team with more victories picks first (tiebreaker: map differential)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-2" />
                      <span><strong>Round Robin:</strong> Random coin flip determines first picker</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-orange-50 rounded-xl p-5 border border-orange-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-orange-200 rounded-lg flex items-center justify-center">
                      <span className="text-orange-600 font-bold text-xs">2</span>
                    </div>
                    <h4 className="font-semibold text-slate-900">MAPPICKING Phase</h4>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    The designated team selects a map from the available pool. Map types follow a strict rotation based on game number:
                  </p>
                  <div className="grid grid-cols-5 gap-2 text-xs text-center mb-3">
                    <div className="bg-white rounded px-2 py-1.5 border border-orange-200">
                      <div className="font-bold text-orange-700">Game 1</div>
                      <div className="text-slate-500">CONTROL</div>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-orange-200">
                      <div className="font-bold text-orange-700">Game 2</div>
                      <div className="text-slate-500">HYBRID</div>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-orange-200">
                      <div className="font-bold text-orange-700">Game 3</div>
                      <div className="text-slate-500">PAYLOAD</div>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-orange-200">
                      <div className="font-bold text-orange-700">Game 4</div>
                      <div className="text-slate-500">PUSH</div>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-orange-200">
                      <div className="font-bold text-orange-700">Game 5</div>
                      <div className="text-slate-500">FLASH/CTRL</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Game 5 allows either FLASHPOINT or CONTROL. Maps already picked in the match cannot be selected again.
                  </p>
                </div>

                <div className="bg-red-50 rounded-xl p-5 border border-red-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-red-200 rounded-lg flex items-center justify-center">
                      <span className="text-red-600 font-bold text-xs">3</span>
                    </div>
                    <h4 className="font-semibold text-slate-900">BAN Phase</h4>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    Teams alternate banning heroes. The team that picked the map bans first. Each team gets 2 bans per game (4 total).
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-4">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2" />
                      <span><strong>Role Limit:</strong> Maximum 2 bans per role (TANK/DPS/SUPPORT) per game</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2" />
                      <span><strong>Turn Timer:</strong> 75 seconds per ban (auto-skips if timeout)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2" />
                      <span><strong>Skip Option:</strong> Teams can skip a ban slot if desired</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-teal-50 rounded-xl p-5 border border-teal-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-teal-200 rounded-lg flex items-center justify-center">
                      <span className="text-teal-600 font-bold text-xs">4</span>
                    </div>
                    <h4 className="font-semibold text-slate-900">ENDMAP Phase</h4>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">
                    The game is played with the selected map and banned heroes. After completion:
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1 ml-4">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mt-2" />
                      <span>Match status changes to PENDINGREGISTERS for stat submission</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mt-2" />
                      <span>Winner is recorded and map scores are updated</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mt-2" />
                      <span>Loser of the game picks the map in the next round</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-teal-400 rounded-full mt-2" />
                      <span>Hero bans reset for each new game</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Timeout Handling */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-100">
                <h3 className="font-semibold text-slate-900 mb-3">Timeout Handling</h3>
                <p className="text-sm text-slate-600 mb-3">
                  To prevent stalling, the system enforces a <strong>75-second turn timer</strong>. If a team exceeds the limit:
                </p>
                <ul className="text-sm text-slate-600 space-y-1 ml-4">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2" />
                    <span><strong>Map Pick Timeout:</strong> A random eligible map is auto-selected</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2" />
                    <span><strong>Ban Timeout:</strong> The ban is skipped (no hero banned)</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
          
          {/* OCR System Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">OCR Recognition System</h2>
                  <p className="text-white/80">Google Cloud Vision-powered scoreboard parsing</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-slate-600 leading-relaxed">
                The platform uses Google Cloud Vision API to extract player statistics directly from 
                Overwatch scoreboard screenshots. This eliminates manual data entry and ensures accuracy 
                through intelligent text clustering and pattern recognition.
              </p>
              
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                    <span className="text-cyan-600 font-bold text-sm">G</span>
                  </div>
                  <h3 className="font-semibold text-slate-900">Google Vision API</h3>
                </div>
                <p className="text-sm text-slate-600">
                  Cloud-based recognition with bounding box geometry analysis. The system clusters detected words 
                  by Y-coordinate to reconstruct table rows and uses column header detection for accurate stat mapping 
                  to the correct categories (Eliminations, Assists, Deaths, Damage, Healing, Mitigation).
                </p>
              </div>

              <div className="bg-gradient-to-r from-slate-50 to-teal-50/50 rounded-xl p-5 border border-slate-100">
                <h3 className="font-semibold text-slate-900 mb-3">Key Algorithms</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-2" />
                    <span><strong className="text-slate-700">Fuzzy Nickname Matching</strong> - Uses Levenshtein distance with OCR-specific substitutions (0=O, 1=I, 5=S) to match detected names to registered players</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-2" />
                    <span><strong className="text-slate-700">Y-Coordinate Clustering</strong> - Groups detected text by vertical position to reconstruct scoreboard rows accurately</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-2" />
                    <span><strong className="text-slate-700">Stat Window Detection</strong> - Scans numeric sequences for valid E/A/D/DMG/H/MIT patterns with sanity bounds checking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-2" />
                    <span><strong className="text-slate-700">Per-10 Normalization</strong> - Converts raw stats to per-10-minute metrics for fair comparison across different game durations</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Database Architecture Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Prisma Database Architecture</h2>
                  <p className="text-white/80">Relational data modeling for esports</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-slate-600 leading-relaxed">
                The backend uses Prisma ORM with SQLite, featuring a carefully designed schema that models 
                the complex relationships between tournaments, teams, matches, and player statistics.
              </p>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                  <div className="text-3xl font-bold text-cyan-600 mb-1">13</div>
                  <div className="text-sm text-slate-600">Data Models</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                  <div className="text-3xl font-bold text-teal-600 mb-1">8</div>
                  <div className="text-sm text-slate-600">Enum Types</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-1">6</div>
                  <div className="text-sm text-slate-600">Stat Categories</div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">Core Models</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { name: "Tournament", desc: "League seasons with state machine (SCHEDULED -> ROUNDROBIN -> PLAYOFFS -> FINALS -> FINISHED)" },
                    { name: "Team", desc: "Organizations with roster management, victory tracking, and map win/loss statistics" },
                    { name: "Match", desc: "Individual games with best-of series, map pools, and real-time status updates" },
                    { name: "DraftTable", desc: "Hero ban/pick tracking with turn-based phase management for competitive drafts" },
                    { name: "PlayerStat", desc: "Per-game statistics with role-based categorization and per-10 normalized metrics" },
                    { name: "Member", desc: "User accounts with role-based permissions (ADMIN, MANAGER, CAPTAIN, EDITOR, DEFAULT)" },
                  ].map((model) => (
                    <div key={model.name} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="font-mono text-sm text-cyan-700 mb-1">{model.name}</div>
                      <p className="text-xs text-slate-600">{model.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Match Lifecycle Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Match Lifecycle</h2>
                  <p className="text-white/80">From scheduling to final results</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-slate-600 leading-relaxed">
                Matches progress through a well-defined lifecycle with status tracking, ready checks, and result submission. 
                The system handles Best-of-3 and Best-of-5 formats with automatic score tallying and team stat updates.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 text-sm bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg font-mono">SCHEDULED</div>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-mono">ACTIVE</div>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg font-mono">PENDINGREGISTERS</div>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="px-3 py-2 bg-green-100 text-green-700 rounded-lg font-mono">FINISHED</div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <h3 className="font-semibold text-slate-900 mb-3">Ready System</h3>
                  <p className="text-sm text-slate-600">
                    Both team captains must mark their team as ready before a match can proceed. 
                    Ready flags reset after each game to ensure continuous confirmation throughout the series.
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <h3 className="font-semibold text-slate-900 mb-3">Result Submission</h3>
                  <p className="text-sm text-slate-600">
                    After each game, managers submit results which update map wins/losses, advance the game number, 
                    store map results in JSON, and determine the next map picker (loser picks).
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Technical Stack Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Technical Stack</h2>
                  <p className="text-white/80">Modern web technologies</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-4">Frontend</h3>
                  <div className="space-y-2">
                    {["Next.js 16 (App Router)", "React 19", "TypeScript", "Tailwind CSS v4", "SWR for Data Fetching"].map((tech) => (
                      <div key={tech} className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                        {tech}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-4">Backend</h3>
                  <div className="space-y-2">
                    {["Node.js + Express", "Prisma ORM", "SQLite Database", "Sharp Image Processing", "Google Cloud Vision API", "JWT Authentication", "bcrypt Password Hashing"].map((tech) => (
                      <div key={tech} className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                        {tech}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Role-Based Access */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                <h3 className="font-semibold text-slate-900 mb-3">Role-Based Access Control</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                    <div className="font-mono text-red-600 font-bold mb-1">ADMIN</div>
                    <div className="text-xs text-slate-500">Full access</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                    <div className="font-mono text-orange-600 font-bold mb-1">MANAGER</div>
                    <div className="text-xs text-slate-500">Match control</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                    <div className="font-mono text-blue-600 font-bold mb-1">CAPTAIN</div>
                    <div className="text-xs text-slate-500">Team actions</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                    <div className="font-mono text-teal-600 font-bold mb-1">EDITOR</div>
                    <div className="text-xs text-slate-500">News & content</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                    <div className="font-mono text-slate-600 font-bold mb-1">DEFAULT</div>
                    <div className="text-xs text-slate-500">View only</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* API Architecture Section */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-green-500 p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">API Architecture</h2>
                  <p className="text-white/80">RESTful endpoints with layered design</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-slate-600 leading-relaxed">
                The backend follows a clean layered architecture: Routes define endpoints and middleware chains, 
                Controllers handle HTTP request/response, Services contain business logic, and Repositories 
                wrap Prisma database operations.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { path: "/member", desc: "User auth, profiles, role management" },
                  { path: "/tournament", desc: "League seasons, state transitions" },
                  { path: "/team", desc: "Roster, stats, leaderboards" },
                  { path: "/match", desc: "Scheduling, results, round-robin" },
                  { path: "/draft", desc: "Map picks, hero bans, state machine" },
                  { path: "/draftAction", desc: "Individual draft actions log" },
                  { path: "/playerStat", desc: "Per-game stats, OCR upload" },
                  { path: "/news", desc: "Community articles, announcements" },
                ].map((route) => (
                  <div key={route.path} className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-start gap-3">
                    <code className="text-sm font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{route.path}</code>
                    <span className="text-sm text-slate-600">{route.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Back to Home */}
          <div className="text-center pt-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-medium rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/25"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
