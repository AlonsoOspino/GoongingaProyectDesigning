import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Developer",
  description: "Meet the developer behind Goonginga League and explore the technical architecture.",
};

export default function DevPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a]">
      {/* Hero Section - Developer Introduction */}
      <section className="relative py-20 overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-30">
          <div 
            className="absolute inset-0" 
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #e5e5e5 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }}
          />
        </div>
        
        {/* Decorative gradient orbs */}
        <div className="absolute top-10 right-[20%] w-64 h-64 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 blur-3xl opacity-60" />
        <div className="absolute bottom-10 left-[10%] w-48 h-48 rounded-full bg-gradient-to-br from-sky-100 to-teal-100 blur-3xl opacity-60" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-10">
              {/* Profile Picture with decorative ring */}
              <div className="relative flex-shrink-0">
                <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 opacity-20 blur-sm" />
                <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-xl">
                  {/* Placeholder for developer image */}
                  <div className="w-full h-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center">
                    <Image
                      src="/images/dev-profile.jpg"
                      alt="Developer profile"
                      width={160}
                      height={160}
                      className="object-cover w-full h-full"
                      priority
                    />
                  </div>
                </div>
                {/* Speech bubble icon */}
                <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-teal-500 flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </div>
              
              {/* Introduction text */}
              <div className="text-center md:text-left">
                <p className="text-sm font-medium text-teal-600 mb-2 tracking-wide uppercase">The Creator</p>
                <h1 className="text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-4">
                  Hi! I&apos;m the Developer
                </h1>
                <p className="text-lg text-[#4a4a4a] leading-relaxed max-w-xl">
                  I built this platform to bring the Goonginga League community together. 
                  From real-time match tracking to automated stat recognition, every feature 
                  was crafted with passion for competitive gaming and clean code.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 justify-center md:justify-start">
                  <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-sm font-medium">Next.js</span>
                  <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-sm font-medium">Prisma</span>
                  <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-sm font-medium">OCR</span>
                  <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-sm font-medium">Express</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="container mx-auto px-4">
        <div className="h-px bg-gradient-to-r from-transparent via-[#e5e5e5] to-transparent" />
      </div>

      {/* Technical Overview Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-sm font-medium text-teal-600 mb-2 tracking-wide uppercase">Under the Hood</p>
              <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-4">
                Technical Architecture
              </h2>
              <p className="text-[#4a4a4a] max-w-2xl mx-auto">
                A deep dive into the algorithms and systems that power the Goonginga League platform.
              </p>
            </div>

            {/* Algorithm Cards */}
            <div className="space-y-12">
              {/* OCR Section */}
              <div className="bg-white rounded-2xl border border-[#e5e5e5] shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">OCR Recognition System</h3>
                  </div>
                </div>
                <div className="p-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-lg font-semibold text-[#1a1a1a] mb-4">Scoreboard OCR Engine</h4>
                      <p className="text-[#4a4a4a] mb-4 leading-relaxed">
                        The heart of our stat tracking system uses <strong>Tesseract.js</strong> combined with 
                        <strong> Sharp</strong> for image preprocessing. Screenshots are analyzed to extract 
                        player statistics automatically.
                      </p>
                      <div className="bg-[#f5f5f5] rounded-xl p-5 border border-[#e5e5e5]">
                        <p className="text-sm font-medium text-[#1a1a1a] mb-3">Key Processing Steps:</p>
                        <ul className="space-y-2 text-sm text-[#4a4a4a]">
                          <li className="flex items-start gap-2">
                            <span className="text-teal-500 mt-0.5">1.</span>
                            <span><strong>Region Extraction</strong> - Relative bounding boxes locate stat columns</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-teal-500 mt-0.5">2.</span>
                            <span><strong>Image Enhancement</strong> - Grayscale, normalize, threshold for clarity</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-teal-500 mt-0.5">3.</span>
                            <span><strong>Multi-threshold OCR</strong> - Multiple passes with varying thresholds</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-teal-500 mt-0.5">4.</span>
                            <span><strong>Stat Window Parsing</strong> - Validates E/A/D/Damage/Healing/Mitigation</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-[#1a1a1a] mb-4">Google Vision API</h4>
                      <p className="text-[#4a4a4a] mb-4 leading-relaxed">
                        For enhanced accuracy, the system integrates with <strong>Google Cloud Vision API</strong>, 
                        providing robust text detection with word-level bounding boxes.
                      </p>
                      <div className="bg-[#f5f5f5] rounded-xl p-5 border border-[#e5e5e5]">
                        <p className="text-sm font-medium text-[#1a1a1a] mb-3">Authentication Methods:</p>
                        <ul className="space-y-2 text-sm text-[#4a4a4a]">
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500" />
                            <span>API Key authentication</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-500" />
                            <span>Service Account credentials</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-sky-500" />
                            <span>Application Default Credentials</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prisma Architecture */}
              <div className="bg-white rounded-2xl border border-[#e5e5e5] shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-500 to-sky-500 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">Prisma Database Architecture</h3>
                  </div>
                </div>
                <div className="p-8">
                  <p className="text-[#4a4a4a] mb-8 leading-relaxed max-w-3xl">
                    The data layer is powered by <strong>Prisma ORM</strong> with SQLite, providing type-safe 
                    database access and a clean schema definition. The architecture follows a modular pattern 
                    with clear separation of concerns.
                  </p>
                  
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Core Models */}
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-5 border border-teal-100">
                      <h5 className="font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-teal-500 text-white text-xs flex items-center justify-center">1</span>
                        Core Entities
                      </h5>
                      <ul className="space-y-1.5 text-sm text-[#4a4a4a]">
                        <li><code className="text-teal-600">Tournament</code> - Season management</li>
                        <li><code className="text-teal-600">Team</code> - Team profiles & stats</li>
                        <li><code className="text-teal-600">Member</code> - Player accounts</li>
                        <li><code className="text-teal-600">Match</code> - Game scheduling</li>
                      </ul>
                    </div>
                    
                    {/* Draft System */}
                    <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-xl p-5 border border-cyan-100">
                      <h5 className="font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-cyan-500 text-white text-xs flex items-center justify-center">2</span>
                        Draft System
                      </h5>
                      <ul className="space-y-1.5 text-sm text-[#4a4a4a]">
                        <li><code className="text-cyan-600">DraftTable</code> - Draft state machine</li>
                        <li><code className="text-cyan-600">DraftAction</code> - Ban/Pick history</li>
                        <li><code className="text-cyan-600">Map</code> - Available maps</li>
                        <li><code className="text-cyan-600">Hero</code> - Character pool</li>
                      </ul>
                    </div>
                    
                    {/* Stats & Content */}
                    <div className="bg-gradient-to-br from-sky-50 to-teal-50 rounded-xl p-5 border border-sky-100">
                      <h5 className="font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-sky-500 text-white text-xs flex items-center justify-center">3</span>
                        Stats & Content
                      </h5>
                      <ul className="space-y-1.5 text-sm text-[#4a4a4a]">
                        <li><code className="text-sky-600">PlayerStat</code> - Performance data</li>
                        <li><code className="text-sky-600">News</code> - League updates</li>
                        <li>Per-10 minute calculations</li>
                        <li>Role-based stat tracking</li>
                      </ul>
                    </div>
                  </div>

                  {/* Architecture Flow */}
                  <div className="mt-8 p-6 bg-[#f5f5f5] rounded-xl border border-[#e5e5e5]">
                    <p className="text-sm font-medium text-[#1a1a1a] mb-4">Request Flow Architecture</p>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                      <span className="px-4 py-2 bg-white rounded-lg border border-[#e5e5e5] font-medium">Route</span>
                      <svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="px-4 py-2 bg-white rounded-lg border border-[#e5e5e5] font-medium">Controller</span>
                      <svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="px-4 py-2 bg-white rounded-lg border border-[#e5e5e5] font-medium">Service</span>
                      <svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="px-4 py-2 bg-white rounded-lg border border-[#e5e5e5] font-medium">Repository</span>
                      <svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <span className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg font-medium">Prisma</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Draft State Machine */}
              <div className="bg-white rounded-2xl border border-[#e5e5e5] shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-sky-500 to-teal-500 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">Draft State Machine</h3>
                  </div>
                </div>
                <div className="p-8">
                  <p className="text-[#4a4a4a] mb-6 leading-relaxed max-w-3xl">
                    The competitive draft system implements a robust state machine with automatic timeout 
                    handling, ensuring fair play even when captains disconnect.
                  </p>
                  
                  <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
                    <div className="flex items-center gap-2 px-4 py-2 bg-teal-100 rounded-lg text-teal-700 font-medium text-sm">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      STARTING
                    </div>
                    <svg className="w-5 h-5 text-[#ccc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <div className="flex items-center gap-2 px-4 py-2 bg-cyan-100 rounded-lg text-cyan-700 font-medium text-sm">
                      <span className="w-2 h-2 rounded-full bg-cyan-500" />
                      MAPPICKING
                    </div>
                    <svg className="w-5 h-5 text-[#ccc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <div className="flex items-center gap-2 px-4 py-2 bg-sky-100 rounded-lg text-sky-700 font-medium text-sm">
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                      BAN
                    </div>
                    <svg className="w-5 h-5 text-[#ccc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <div className="flex items-center gap-2 px-4 py-2 bg-teal-100 rounded-lg text-teal-700 font-medium text-sm">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      ENDMAP
                    </div>
                    <svg className="w-5 h-5 text-[#ccc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-lg text-emerald-700 font-medium text-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      FINISHED
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-[#f5f5f5] rounded-xl p-5 border border-[#e5e5e5]">
                      <p className="text-sm font-medium text-[#1a1a1a] mb-3">Timeout Rules</p>
                      <ul className="space-y-2 text-sm text-[#4a4a4a]">
                        <li className="flex items-center gap-2">
                          <span className="text-teal-500 font-mono">75s</span>
                          <span>Turn timeout duration</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-teal-500 font-mono">Auto</span>
                          <span>Random map pick on timeout</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-teal-500 font-mono">Skip</span>
                          <span>Auto skip-ban action</span>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-[#f5f5f5] rounded-xl p-5 border border-[#e5e5e5]">
                      <p className="text-sm font-medium text-[#1a1a1a] mb-3">Map Type Order</p>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="px-2 py-1 bg-white rounded border border-[#e5e5e5]">1. Control</span>
                        <span className="px-2 py-1 bg-white rounded border border-[#e5e5e5]">2. Hybrid</span>
                        <span className="px-2 py-1 bg-white rounded border border-[#e5e5e5]">3. Payload</span>
                        <span className="px-2 py-1 bg-white rounded border border-[#e5e5e5]">4. Push</span>
                        <span className="px-2 py-1 bg-white rounded border border-[#e5e5e5]">5. Flashpoint</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Back to Home */}
      <section className="py-12 bg-gradient-to-r from-teal-500 to-cyan-500">
        <div className="container mx-auto px-4 text-center">
          <p className="text-white/80 mb-4">Thanks for checking out the tech behind Goonginga League!</p>
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-teal-600 font-semibold rounded-lg hover:bg-white/90 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Homepage
          </Link>
        </div>
      </section>
    </div>
  );
}
