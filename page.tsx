"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive, ArrowLeft, ArrowUp, BarChart3, Bell, Blocks, Bot,
  Check, ChevronDown, ChevronRight, CircleHelp, Command, CreditCard,
  FileCode2, Folder, FolderGit2, Gauge, GitBranch, GitPullRequest, Globe2,
  HardDrive, Image as ImageIcon, Keyboard, Laptop, LogIn, LogOut, Menu,
  MessageSquarePlus, Mic, Monitor, Moon, Palette, Paperclip, Plug, Plus,
  Search, Settings, Sparkles, Trash2, UserRound, Volume2, WandSparkles, X, Zap,
  Link as LinkIcon
} from "lucide-react";

/* ── types ─────────────────────────────────────────────── */
type Message = { role: "user" | "assistant" | "system"; content: string; ts?: number };
type Conversation = { id: string; title: string; msgs: Message[]; created: number };
type SideView = "chat" | "projects" | "prs" | "sites" | "scheduled";

/* ── constants ─────────────────────────────────────────── */
const WELCOME = ["What should we build?", "What do you want to work on?", "Where should we begin?", "What can Constella solve with you?"];

const CHIPS = [
  { label: "Build a landing page", emoji: "🚀" },
  { label: "Debug my code", emoji: "🐛" },
  { label: "Explain an algorithm", emoji: "🧠" },
  { label: "Write a research summary", emoji: "📝" },
  { label: "Design a database schema", emoji: "🗄️" },
  { label: "Create an API endpoint", emoji: "⚡" },
];

const MODELS = [
  { id: "deepseek", name: "DeepSeek", version: "V4 Pro", color: "#5aa7ff", icon: "D", best: "Reasoning lead", summary: "Architecture, mathematics, logic, planning", tasks: ["Deep reasoning", "System architecture", "Math & logic", "Plan a complex task"] },
  { id: "codex", name: "Codex", version: "GPT-5.3", color: "#f3f3f3", icon: "C", best: "Engineering lead", summary: "Build, debug, review, ship", tasks: ["Write code", "Debug a problem", "Review a codebase", "Build a feature"] },
  { id: "gemini", name: "Gemini", version: "3.1 Pro", color: "#b38cff", icon: "G", best: "Multimodal lead", summary: "Research, images, video, long context", tasks: ["Generate an image", "Research the web", "Analyze media", "Explore a large document"] },
  { id: "claude", name: "Claude", version: "Sonnet 5", color: "#e99666", icon: "A", best: "Synthesis lead", summary: "Writing, analysis, nuanced communication", tasks: ["Write & refine", "Synthesize research", "Analyze a document", "Explain with clarity"] },
];

const SETTINGS_GROUPS = [
  { title: "Account", items: ["General", "Profile", "Appearance", "Voice configuration", "Personalization", "Keyboard shortcuts", "Usage", "Billing"] },
  { title: "Your account", items: ["App settings", "Plugins", "Browser", "Computer use", "Hooks", "Connections", "Git environments", "Worktrees"] },
];

const USAGE_MAX = 100;
const REFRESH_MS = 3_600_000; // 1 hour

/* ── helpers ───────────────────────────────────────────── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function titleFrom(s: string) { const c = s.trim().replace(/\n/g, " "); return c.length <= 40 ? c : c.slice(0, 37) + "…"; }
function usageCost(msg: string) { const n = msg.trim().length; if (n < 50) return 2; if (n <= 150) return 5; return 10; }

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════ */
export default function Home() {
  /* ── conversations ── */
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);

  /* ── usage ── */
  const [usage, setUsage] = useState(USAGE_MAX);
  const [refreshAt, setRefreshAt] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(REFRESH_MS);

  /* ── UI chrome ── */
  const [welcome, setWelcome] = useState(WELCOME[0]);
  const [message, setMessage] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState("General");
  const [signedIn, setSignedIn] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);
  const [plan, setPlan] = useState(true);
  const [activeModel, setActiveModel] = useState<(typeof MODELS)[number] | null>(null);
  const [roleStage, setRoleStage] = useState<"task" | "authority">("task");
  const [chosenTask, setChosenTask] = useState("");
  const [weights, setWeights] = useState<Record<string, number>>({ deepseek: 25, codex: 25, gemini: 25, claude: 25 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [view, setView] = useState<SideView>("chat");
  const [sideOpen, setSideOpen] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  /* ── API connections ── */
  const [connections, setConnections] = useState<Record<string, boolean>>({});

  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const active = convos.find(c => c.id === activeId) ?? null;

  /* ── effects ── */
  useEffect(() => setWelcome(WELCOME[Math.floor(Math.random() * WELCOME.length)]), []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.msgs.length, typing]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  // Fetch connection status
  useEffect(() => {
    fetch("/api/chat/status")
      .then(res => res.json())
      .then(data => setConnections(data))
      .catch(console.error);
  }, []);

  // Usage refresh timer
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const diff = now - refreshAt;
      if (diff >= REFRESH_MS) { setUsage(USAGE_MAX); setRefreshAt(now); setTimeLeft(REFRESH_MS); }
      else setTimeLeft(REFRESH_MS - diff);
    }, 1_000);
    return () => clearInterval(id);
  }, [refreshAt]);

  /* ── API Routing Logic ── */
  function getBestModel() {
    // 1. Check if user explicitly selected a model via team strip
    if (activeModel && connections[activeModel.id === "codex" ? "openai" : activeModel.id]) {
      return activeModel.id === "codex" ? "openai" : activeModel.id;
    }
    // 2. Sort models by weight
    const sorted = Object.entries(weights).sort(([, a], [, b]) => b - a);
    // 3. Find the highest weighted model that has a connected API key
    for (const [id] of sorted) {
      const provider = id === "codex" ? "openai" : id;
      if (connections[provider]) return provider;
    }
    // 4. Default to openai if nothing is connected (will return a helpful error)
    return "openai";
  }

  /* ── actions ── */
  async function send(custom?: string) {
    const txt = (custom ?? message).trim();
    if (!txt || usage <= 0 || typing) return;

    const cost = usageCost(txt);
    setUsage(u => Math.max(0, u - cost));

    const userMsg: Message = { role: "user", content: txt, ts: Date.now() };
    let convId = activeId;
    let newConvos = [...convos];

    if (convId && active) {
      newConvos = newConvos.map(c => c.id === convId ? { ...c, msgs: [...c.msgs, userMsg] } : c);
      setConvos(newConvos);
    } else {
      convId = uid();
      newConvos = [{ id: convId!, title: titleFrom(txt), msgs: [userMsg], created: Date.now() }, ...newConvos];
      setConvos(newConvos);
      setActiveId(convId);
    }

    setMessage("");
    setAttachOpen(false);
    setTyping(true);

    const convoToSend = newConvos.find(c => c.id === convId);
    const targetId = convId;

    try {
      const provider = getBestModel();
      const systemPrompt = "You are Constella, an advanced AI workspace. Answer concisely and professionally.";
      const messagesPayload = [
        { role: "system", content: systemPrompt },
        ...(convoToSend?.msgs || []).map(m => ({ role: m.role, content: m.content }))
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: provider, messages: messagesPayload }),
      });

      const data = await res.json();
      
      let replyContent = "";
      if (res.ok) {
        replyContent = data.content;
      } else {
        replyContent = `Error from ${provider}: ${data.error || "Unknown error"}`;
      }

      const reply: Message = { role: "assistant", content: replyContent, ts: Date.now() };
      setConvos(prev => prev.map(c => c.id === targetId ? { ...c, msgs: [...c.msgs, reply] } : c));
    } catch (err: any) {
      const reply: Message = { role: "assistant", content: `Network error: ${err.message}`, ts: Date.now() };
      setConvos(prev => prev.map(c => c.id === targetId ? { ...c, msgs: [...c.msgs, reply] } : c));
    } finally {
      setTyping(false);
    }
  }

  function newChat() { setActiveId(null); setMessage(""); setView("chat"); }
  function deleteConvo(id: string) { setConvos(prev => prev.filter(c => c.id !== id)); if (activeId === id) setActiveId(null); }
  function openSettings(t = "General") { setSection(t); setSettingsOpen(true); setProfileOpen(false); }
  function adjustModel(dir: "more" | "less") { if (!activeModel) return; const d = dir === "more" ? 8 : -8; setWeights(w => ({ ...w, [activeModel.id]: Math.max(8, Math.min(65, w[activeModel.id] + d)) })); setActiveModel(null); setRoleStage("task"); }

  const filteredConvos = searchQ ? convos.filter(c => c.title.toLowerCase().includes(searchQ.toLowerCase())) : convos;
  const usagePct = Math.round((usage / USAGE_MAX) * 100);

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <main className="constella-app">
      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <aside className={`side-rail ${sideOpen ? "" : "collapsed"}`}>
        <div className="window-row">
          <button aria-label="Toggle sidebar" onClick={() => setSideOpen(o => !o)}><Menu size={15} /></button>
        </div>

        <div className="rail-brand">
          <div className="brand-glyph"><img src="/logo.png" alt="Constella Logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "4px" }} /></div>
          <strong>Constella</strong><ChevronDown size={15} />
          <button className="rail-search" aria-label="Search" onClick={() => setSearchOpen(true)}><Search size={17} /></button>
        </div>

        <nav className="rail-nav">
          <button className={view === "chat" && !activeId ? "active" : ""} onClick={newChat}><MessageSquarePlus size={18} />New chat</button>
          <button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}><Folder size={18} />Projects</button>
          <button className={view === "prs" ? "active" : ""} onClick={() => setView("prs")}><GitPullRequest size={18} />Pull requests</button>
          <button className={view === "sites" ? "active" : ""} onClick={() => setView("sites")}><Blocks size={18} />Sites</button>
          <button className={view === "scheduled" ? "active" : ""} onClick={() => setView("scheduled")}><Bell size={18} />Scheduled</button>
          <button onClick={() => openSettings("Plugins")}><Plug size={18} />Plugins</button>
        </nav>

        {/* conversations list */}
        <div className="rail-section recents">
          <span>Conversations</span>
          {convos.length === 0 && <p className="empty-hint">No conversations yet.<br />Press <strong>New chat</strong> to start.</p>}
          {filteredConvos.map(c => (
            <button
              key={c.id}
              className={activeId === c.id ? "selected" : ""}
              onClick={() => { setActiveId(c.id); setView("chat"); }}
              onMouseEnter={() => setHovered(c.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {c.title}
              {hovered === c.id && (
                <span className="chat-actions" onClick={e => { e.stopPropagation(); deleteConvo(c.id); }}>
                  <Trash2 size={14} />
                </span>
              )}
            </button>
          ))}
        </div>

        {/* account */}
        <div className="account-anchor">
          {profileOpen && signedIn && (
            <div className="profile-menu">
              <div className="profile-menu-head">
                <div className="avatar">U</div>
                <div><strong>User</strong><span>user@constella.ai</span></div>
              </div>
              <div className="usage-mini">
                <div><span>Usage</span><b>{usage} / {USAGE_MAX}</b></div>
                <div className="usage-track"><i style={{ width: `${usagePct}%` }} /></div>
                <small>Refreshes in {fmtTime(timeLeft)}</small>
              </div>
              <button onClick={() => openSettings("General")}><Settings size={16} />Settings</button>
              <button onClick={() => openSettings("Archived chats")}><Archive size={16} />Archived chats</button>
              <button className="logout" onClick={() => { setSignedIn(false); setProfileOpen(false); }}><LogOut size={16} />Log out</button>
            </div>
          )}
          {!signedIn
            ? <button className="account-row signin" onClick={() => setSignedIn(true)}><LogIn size={17} />Sign in to Constella</button>
            : <button className="account-row" onClick={() => setProfileOpen(!profileOpen)}><div className="avatar">U</div><strong>User</strong><CircleHelp size={17} /></button>}
        </div>
      </aside>

      {/* ── MAIN PANEL ──────────────────────────────────── */}
      <section className="main-panel">
        <header className="main-topbar">
          <button onClick={() => setSideOpen(o => !o)}><Menu size={17} /></button>
          <div><strong>{active ? active.title : "New chat"}</strong><span>Constella team active</span></div>
          <div className="topbar-right">
            <span className="usage-badge">{usage} pts</span>
            <span className="team-online"><i />4 models coordinated</span>
            <button onClick={() => openSettings("Keyboard shortcuts")}><Command size={17} /></button>
          </div>
        </header>

        {/* ── SIDE VIEWS (coming soon) ── */}
        {view !== "chat" && (
          <div className="coming-soon-panel">
            <div className="coming-soon-icon">
              {view === "projects" && <Folder size={40} />}
              {view === "prs" && <GitPullRequest size={40} />}
              {view === "sites" && <Blocks size={40} />}
              {view === "scheduled" && <Bell size={40} />}
            </div>
            <h2>{view === "projects" ? "Projects" : view === "prs" ? "Pull Requests" : view === "sites" ? "Sites" : "Scheduled"}</h2>
            <p>This feature is coming soon. Stay tuned!</p>
            <button className="back-to-chat" onClick={() => setView("chat")}><ArrowLeft size={16} />Back to chat</button>
          </div>
        )}

        {/* ── CHAT STAGE ── */}
        {view === "chat" && (
          <div className="chat-stage">
            {/* empty / welcome */}
            {!active && (
              <>
                <div className="welcome">
                  <div className="welcome-mark"><img src="/logo.png" alt="Constella Logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "12px" }} /></div>
                  <h1>{welcome}</h1>
                  <p>Constella quietly assembles the right team for the work.</p>
                </div>

                <div className="chip-row">
                  {CHIPS.map(c => (
                    <button key={c.label} className="chip" onClick={() => { setMessage(c.label); }}>
                      <span className="chip-emoji">{c.emoji}</span>{c.label}
                    </button>
                  ))}
                </div>

                <div className="team-strip" aria-label="Constella model team">
                  <div className="team-label"><Sparkles size={14} /><span><strong>Constella team</strong><small>Working as one intelligence</small></span></div>
                  {MODELS.map(m => (
                    <button key={m.id} onClick={() => { setActiveModel(m); setRoleStage("task"); }}>
                      <i style={{ background: m.color, color: m.id === "codex" ? "#171717" : "#fff" }}>{m.icon}</i>
                      <span><strong>{m.name}</strong><small>{m.best}</small></span><b>{weights[m.id]}%</b>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* messages */}
            {active && (
              <div className="messages-scroll">
                {active.msgs.filter(m => m.role !== "system").map((m, i) => (
                  <div key={i} className={`msg ${m.role}`}>
                    {m.role === "assistant" && <div className="msg-avatar"><Sparkles size={14} /></div>}
                    <div className="msg-bubble">
                      {m.content.split("\n").map((line, j) => <p key={j}>{line || "\u00A0"}</p>)}
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="msg assistant">
                    <div className="msg-avatar"><Sparkles size={14} /></div>
                    <div className="msg-bubble typing-indicator">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}

            {/* composer */}
            <div className="composer-zone">
              {usage <= 0 && <div className="usage-depleted"><Zap size={15} />Usage depleted. Refreshes in {fmtTime(timeLeft)}.</div>}
              <div className="composer-box">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={usage > 0 ? "Do anything" : "Waiting for usage refresh…"}
                  disabled={usage <= 0}
                  aria-label="Message Constella"
                />
                <div className="composer-actions">
                  <div className="attach-anchor">
                    <button onClick={() => setAttachOpen(!attachOpen)} aria-label="Add files"><Plus size={20} /></button>
                    {attachOpen && (
                      <div className="attach-pop">
                        <button onClick={() => fileRef.current?.click()}><Paperclip size={16} />Files</button>
                        <button onClick={() => fileRef.current?.click()}><Folder size={16} />Folder</button>
                        <button><ImageIcon size={16} />Image</button>
                      </div>
                    )}
                  </div>
                  <input hidden multiple type="file" ref={fileRef} />
                  <button className={plan ? "plan-active" : ""} onClick={() => setPlan(!plan)}><FileCode2 size={16} />{plan ? "Plan on" : "Plan off"}</button>
                  <div className="composer-spacer" />
                  <div className="unity-pill"><Sparkles size={14} /><span>Constella Auto</span><ChevronDown size={14} /></div>
                  <button aria-label="Dictate"><Mic size={18} /></button>
                  <button className="send" disabled={!message.trim() || usage <= 0} onClick={() => send()}><ArrowUp size={18} /></button>
                </div>
              </div>
              <p className="composer-note">One account. One conversation. Every model contributes behind the scenes. <span className="usage-inline">Usage: {usage}/{USAGE_MAX}</span></p>
            </div>
          </div>
        )}
      </section>

      {/* ── SEARCH OVERLAY ────────────────────────────── */}
      {searchOpen && (
        <div className="search-overlay" onClick={e => { if (e.target === e.currentTarget) { setSearchOpen(false); setSearchQ(""); } }}>
          <div className="search-box">
            <Search size={18} />
            <input ref={searchRef} value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search conversations…" />
            <button onClick={() => { setSearchOpen(false); setSearchQ(""); }}><X size={16} /></button>
          </div>
          <div className="search-results">
            {convos.filter(c => c.title.toLowerCase().includes(searchQ.toLowerCase())).map(c => (
              <button key={c.id} onClick={() => { setActiveId(c.id); setView("chat"); setSearchOpen(false); setSearchQ(""); }}>
                <MessageSquarePlus size={15} />{c.title}
              </button>
            ))}
            {convos.length === 0 && <p className="search-empty">No conversations to search.</p>}
            {convos.length > 0 && convos.filter(c => c.title.toLowerCase().includes(searchQ.toLowerCase())).length === 0 && (
              <p className="search-empty">No matches found.</p>
            )}
          </div>
        </div>
      )}

      {/* ── MODEL CONTROL DRAWER ──────────────────────── */}
      {activeModel && (
        <div className="model-control">
          <div className="model-control-head">
            <div className="model-avatar" style={{ background: activeModel.color, color: activeModel.id === "codex" ? "#171717" : "#fff" }}>{activeModel.icon}</div>
            <div><strong>{activeModel.name}</strong><span>{activeModel.version} · {activeModel.summary}</span></div>
            <button onClick={() => setActiveModel(null)}><X size={16} /></button>
          </div>
          {roleStage === "task" ? (
            <>
              <p>What should {activeModel.name} lead?</p>
              <div className="task-grid">{activeModel.tasks.map(task => <button key={task} onClick={() => { setChosenTask(task); setRoleStage("authority"); }}>{task}<ChevronRight size={14} /></button>)}</div>
            </>
          ) : (
            <>
              <button className="back-step" onClick={() => setRoleStage("task")}><ArrowLeft size={14} />{chosenTask}</button>
              <p>How much authority should it have?</p>
              <div className="authority-options" style={{ padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "13px", color: "#ccc" }}>
                  <span>0%</span>
                  <strong style={{ color: "#fff", fontSize: "15px" }}>{weights[activeModel.id]}%</strong>
                  <span>100%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={weights[activeModel.id]} 
                  onChange={e => setWeights(w => ({ ...w, [activeModel.id]: Number(e.target.value) }))} 
                  style={{ width: "100%", accentColor: "#8d86ff", marginBottom: "16px" }} 
                />
                <button style={{ width: "100%", background: "#fff", color: "#000", padding: "10px", borderRadius: "8px", justifyContent: "center", fontWeight: "600" }} onClick={() => { setActiveModel(null); setRoleStage("task"); }}>Apply</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SETTINGS MODAL ────────────────────────────── */}
      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <section className="settings-modal">
            <aside className="settings-nav">
              <div className="settings-title"><strong>Settings</strong><button onClick={() => setSettingsOpen(false)}><X size={17} /></button></div>
              {SETTINGS_GROUPS.map(g => (
                <div key={g.title}><span>{g.title}</span>{g.items.map(item => (
                  <button className={section === item ? "active" : ""} key={item} onClick={() => setSection(item)}>{settingIcon(item)}{item}</button>
                ))}</div>
              ))}
              <div><span>Chat history</span><button className={section === "Archived chats" ? "active" : ""} onClick={() => setSection("Archived chats")}><Archive size={16} />Archived chats</button></div>
            </aside>
            <div className="settings-content">{renderSettings(section, weights, setWeights, usage, usagePct, timeLeft, connections)}</div>
          </section>
        </div>
      )}
    </main>
  );
}

/* ── settings helpers ──────────────────────────────────── */
function settingIcon(item: string) {
  const m: Record<string, React.ReactNode> = {
    General: <Settings size={16} />, Profile: <UserRound size={16} />, Appearance: <Palette size={16} />,
    "Voice configuration": <Volume2 size={16} />, Personalization: <Sparkles size={16} />,
    "Keyboard shortcuts": <Keyboard size={16} />, Usage: <BarChart3 size={16} />, Billing: <CreditCard size={16} />,
    "App settings": <Monitor size={16} />, Plugins: <Plug size={16} />, Browser: <Globe2 size={16} />,
    "Computer use": <Laptop size={16} />, Hooks: <GitBranch size={16} />, Connections: <LinkIcon size={16} />,
    "Git environments": <FolderGit2 size={16} />, Worktrees: <FolderGit2 size={16} />,
  };
  return m[item];
}

function renderSettings(section: string, weights: Record<string, number>, setWeights: React.Dispatch<React.SetStateAction<Record<string, number>>>, usage: number, usagePct: number, timeLeft: number, connections: Record<string, boolean>) {
  if (section === "Connections") return (
    <>
      <SettingsHeader title="Connections" subtitle="Connect external AI providers using your own API keys." />
      <div className="model-settings">
        <h3>API Keys</h3>
        <p>API keys are securely stored on your Cloudflare Worker. They are never exposed to the browser.</p>
        
        {MODELS.map(model => {
          const providerId = model.id === "codex" ? "openai" : model.id;
          const isConnected = connections[providerId];
          const envVar = providerId === "openai" ? "OPENAI_API_KEY" : providerId === "claude" ? "ANTHROPIC_API_KEY" : providerId === "gemini" ? "GEMINI_API_KEY" : "DEEPSEEK_API_KEY";
          
          return (
            <div className="model-setting" key={model.id}>
              <i style={{ background: model.color, color: model.id === "codex" ? "#171717" : "white" }}>{model.icon}</i>
              <div>
                <strong>{model.name} Provider</strong>
                <span>{isConnected ? "Connected successfully" : `Requires ${envVar}`}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: isConnected ? "#62c48d" : "#777" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: isConnected ? "#62c48d" : "#555" }} />
                {isConnected ? "Connected" : "Not connected"}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: "11px", color: "#aaa", lineHeight: 1.6 }}>
        To connect a provider, go to your <strong>Cloudflare Dashboard → Settings → Variables and secrets</strong> and add the missing environment variables with your API keys.
      </p>
    </>
  );

  if (section === "Usage") return (
    <>
      <SettingsHeader title="Usage" subtitle="Your unified allowance across every Constella model." />
      <div className="usage-card">
        <div className="usage-ring"><span>{usagePct}%</span><small>remaining</small></div>
        <div>
          <h3>Constella intelligence</h3>
          <p>{usage} of 100 points remaining. Refreshes in {fmtTime(timeLeft)}.</p>
          <div className="usage-legend">
            <span><i className="u1" />Simple (2 pts)</span>
            <span><i className="u2" />Medium (5 pts)</span>
            <span><i className="u3" />Complex (10 pts)</span>
          </div>
        </div>
      </div>
    </>
  );
  if (section === "Archived chats") return (
    <>
      <SettingsHeader title="Archived chats" subtitle="Chats hidden from your sidebar stay available here." />
      <div className="archive-list">
        <p className="empty-hint" style={{ textAlign: "center", padding: "2rem" }}>No archived chats yet.</p>
      </div>
    </>
  );
  if (section === "App settings") return (
    <>
      <SettingsHeader title="App settings" subtitle="Control how Constella's model team works together." />
      <div className="model-settings">
        <h3>Model team</h3>
        <p>All four models share the same conversation and account. Adjust their default influence.</p>
        {MODELS.map(model => (
          <div className="model-setting" key={model.id}>
            <i style={{ background: model.color, color: model.id === "codex" ? "#171717" : "white" }}>{model.icon}</i>
            <div><strong>{model.name}</strong><span>{model.summary}</span></div>
            <input aria-label={`${model.name} influence`} type="range" min="8" max="65" value={weights[model.id]} onChange={e => setWeights(w => ({ ...w, [model.id]: Number(e.target.value) }))} />
            <b>{weights[model.id]}%</b>
          </div>
        ))}
      </div>
      <div className="setting-row"><div><strong>Automatic lead selection</strong><span>Constella chooses a lead based on your task.</span></div><Toggle /></div>
      <div className="setting-row"><div><strong>Cross-check important answers</strong><span>A second model quietly verifies critical work.</span></div><Toggle /></div>
    </>
  );
  if (section === "Appearance") return (
    <>
      <SettingsHeader title="Appearance" subtitle="Make Constella feel at home on your device." />
      <div className="theme-grid">
        <button className="theme selected"><Moon size={22} /><span>Dark</span><Check size={15} /></button>
        <button className="theme"><Monitor size={22} /><span>System</span></button>
        <button className="theme light"><Sparkles size={22} /><span>Light</span></button>
      </div>
    </>
  );
  if (section === "Profile") return (
    <>
      <SettingsHeader title="Profile" subtitle="Manage your public profile and Constella identity." />
      <div className="setting-row"><div><strong>Display Name</strong><span>Your name as shown in the interface.</span></div><span style={{ fontSize: "12px", color: "#ddd" }}>User</span></div>
      <div className="setting-row"><div><strong>Email Address</strong><span>The email associated with your account.</span></div><span style={{ fontSize: "12px", color: "#ddd" }}>user@constella.ai</span></div>
      <div className="setting-row"><div><strong>Public Profile</strong><span>Allow other users to view your shared projects.</span></div><Toggle /></div>
    </>
  );
  if (section === "Voice configuration") return (
    <>
      <SettingsHeader title="Voice configuration" subtitle="Adjust the speech-to-text and AI voice settings." />
      <div className="setting-row"><div><strong>Voice Model</strong><span>Select the AI voice personality.</span></div><button style={{ background: "#333", border: "1px solid #444", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", color: "#ddd" }}>Nova (Female)</button></div>
      <div className="setting-row"><div><strong>Speaking Speed</strong><span>How fast the AI reads responses.</span></div><input type="range" min="0.5" max="2" step="0.1" defaultValue="1" style={{ accentColor: "#8d86ff" }} /></div>
      <div className="setting-row"><div><strong>Auto-Read</strong><span>Automatically read out long responses.</span></div><Toggle /></div>
    </>
  );
  if (section === "Personalization") return (
    <>
      <SettingsHeader title="Personalization" subtitle="Teach Constella how to respond to you." />
      <div className="model-settings">
        <p><strong>Custom Instructions</strong><br/>What would you like Constella to know about you to provide better responses?</p>
        <textarea style={{ width: "100%", height: "80px", background: "#222", border: "1px solid #444", borderRadius: "8px", padding: "8px", color: "#ddd", marginTop: "10px", fontSize: "12px", resize: "none" }} placeholder="E.g., I'm a React developer. Prefer TypeScript. Keep answers concise." />
      </div>
      <div className="setting-row"><div><strong>Remember past chats</strong><span>Use previous context to inform new conversations.</span></div><Toggle /></div>
    </>
  );
  if (section === "Keyboard shortcuts") return (
    <>
      <SettingsHeader title="Keyboard shortcuts" subtitle="Speed up your workflow." />
      <div className="setting-row"><div><strong>New Chat</strong></div><span style={{ background: "#333", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", border: "1px solid #444" }}>⌘ + N</span></div>
      <div className="setting-row"><div><strong>Open Settings</strong></div><span style={{ background: "#333", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", border: "1px solid #444" }}>⌘ + ,</span></div>
      <div className="setting-row"><div><strong>Focus Chat</strong></div><span style={{ background: "#333", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", border: "1px solid #444" }}>Shift + Esc</span></div>
    </>
  );
  if (section === "Billing") return (
    <>
      <SettingsHeader title="Billing" subtitle="Manage your subscription and payment methods." />
      <div className="usage-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: "10px" }}>
        <h3 style={{ margin: 0 }}>Pro Plan</h3>
        <p style={{ margin: 0, color: "#888", fontSize: "12px" }}>$20.00 / month. Next billing date: Aug 24, 2026.</p>
        <button style={{ background: "#8d86ff", color: "white", border: 0, padding: "6px 14px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", marginTop: "8px" }}>Manage Subscription</button>
      </div>
    </>
  );
  if (section === "Plugins") return (
    <>
      <SettingsHeader title="Plugins" subtitle="Connect third-party tools to Constella." />
      <div className="setting-row"><div><strong>GitHub Integration</strong><span>Allow Constella to read/write to your repositories.</span></div><Toggle /></div>
      <div className="setting-row"><div><strong>Vercel Deployment</strong><span>Deploy sites directly from chat.</span></div><button className="toggle" aria-label="Toggle setting"><i /></button></div>
      <div className="setting-row"><div><strong>Figma Link</strong><span>Analyze designs directly from Figma URLs.</span></div><Toggle /></div>
    </>
  );
  if (section === "Browser") return (
    <>
      <SettingsHeader title="Browser" subtitle="Configure web browsing capabilities." />
      <div className="setting-row"><div><strong>Enable Web Search</strong><span>Allow Constella to search the internet for current events.</span></div><Toggle /></div>
      <div className="setting-row"><div><strong>Bypass Paywalls</strong><span>Attempt to read articles behind paywalls.</span></div><button className="toggle" aria-label="Toggle setting"><i /></button></div>
    </>
  );
  if (section === "Computer use") return (
    <>
      <SettingsHeader title="Computer use" subtitle="Configure local execution environments." />
      <div className="setting-row"><div><strong>Docker Sandboxing</strong><span>Run code safely in isolated containers.</span></div><Toggle /></div>
      <div className="setting-row"><div><strong>Terminal Access</strong><span>Allow AI to run bash commands in workspace.</span></div><Toggle /></div>
    </>
  );
  if (section === "Hooks") return (
    <>
      <SettingsHeader title="Hooks" subtitle="Manage Git and system hooks." />
      <div className="setting-row"><div><strong>Pre-commit Analysis</strong><span>Auto-review code before committing.</span></div><Toggle /></div>
      <div className="setting-row"><div><strong>Build Monitoring</strong><span>Notify Constella when a build fails.</span></div><button className="toggle" aria-label="Toggle setting"><i /></button></div>
    </>
  );
  if (section === "Git environments") return (
    <>
      <SettingsHeader title="Git environments" subtitle="Manage your connected repositories." />
      <div className="setting-row"><div><strong>Default Branch</strong><span>Always checkout this branch when opening a repo.</span></div><span style={{ fontSize: "12px", color: "#ddd" }}>main</span></div>
      <div className="setting-row"><div><strong>Auto-fetch</strong><span>Periodically fetch from remote.</span></div><Toggle /></div>
    </>
  );
  if (section === "Worktrees") return (
    <>
      <SettingsHeader title="Worktrees" subtitle="Manage concurrent isolated branch checkouts." />
      <div className="setting-row"><div><strong>Enable Worktrees</strong><span>Allow multiple active branches at once.</span></div><Toggle /></div>
      <div className="setting-row"><div><strong>Prune old worktrees</strong><span>Automatically delete worktrees older than 14 days.</span></div><button className="toggle" aria-label="Toggle setting"><i /></button></div>
    </>
  );

  return (
    <>
      <SettingsHeader title={section} subtitle={`Manage your ${section.toLowerCase()} preferences in Constella.`} />
      <div className="setting-row"><div><strong>Use recommended settings</strong><span>Balanced defaults for the unified Constella experience.</span></div><Toggle /></div>
      <div className="setting-row"><div><strong>Sync across devices</strong><span>Keep this preference with your Constella account.</span></div><Toggle /></div>
      {section === "General" && (
        <div className="model-settings overview">
          <h3>Your model team</h3>
          <p>DeepSeek, Codex, Gemini, and Claude work inside Constella as one coordinated system. You never switch apps.</p>
          {MODELS.map(model => (
            <div className="model-setting" key={model.id}>
              <i style={{ background: model.color, color: model.id === "codex" ? "#171717" : "white" }}>{model.icon}</i>
              <div><strong>{model.name}<em>{model.best}</em></strong><span>{model.summary}</span></div>
              <Check size={16} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function fmtTime(ms: number) { const m = Math.max(0, Math.ceil(ms / 60_000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; }
function SettingsHeader({ title, subtitle }: { title: string; subtitle: string }) { return <header className="settings-header"><h2>{title}</h2><p>{subtitle}</p></header>; }
function Toggle() { return <button className="toggle on" aria-label="Toggle setting"><i /></button>; }
