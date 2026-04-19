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
                  {/* Replace /dev-pfp.jpg with your actual profile picture path */}
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
                    <svg className="w-20 h-20 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                {/* Speech bubble indicator */}
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
                  The Goonginga League is powered by custom-built algorithms for real-time stat tracking, 
                  intelligent OCR processing, and a robust tournament management system. 
                  Let me walk you through how it all works.
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
                  <p className="text-white/80">Intelligent scoreboard parsing</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <p className="text-slate-600 leading-relaxed">
                The platform features a dual-engine OCR system that extracts player statistics directly from 
                Overwatch scoreboard screenshots. This eliminates manual data entry and ensures accuracy.
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                      <span className="text-teal-600 font-bold text-sm">T</span>
                    </div>
                    <h3 className="font-semibold text-slate-900">Tesseract.js Engine</h3>
                  </div>
                  <p className="text-sm text-slate-600">
                    Local OCR processing using Sharp for image preprocessing. Applies grayscale normalization, 
                    threshold optimization, and region-based extraction for consistent results across different screenshot qualities.
                  </p>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
                      <span className="text-cyan-600 font-bold text-sm">G</span>
                    </div>
                    <h3 className="font-semibold text-slate-900">Google Vision API</h3>
                  </div>
                  <p className="text-sm text-slate-600">
                    Cloud-based recognition with bounding box geometry analysis. Clusters words by Y-coordinate 
                    to reconstruct table rows and uses column header detection for accurate stat mapping.
                  </p>
                </div>
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
            
            <div className="p-6">
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
                    {["Node.js + Express", "Prisma ORM", "SQLite Database", "Tesseract.js + Sharp", "Google Cloud Vision API"].map((tech) => (
                      <div key={tech} className="flex items-center gap-2 text-sm text-slate-600">
                        <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                        {tech}
                      </div>
                    ))}
                  </div>
                </div>
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
