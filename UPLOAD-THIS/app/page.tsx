"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive, ArrowLeft, ArrowUp, BarChart3, Bell, Blocks, Bot,
  Check, ChevronDown, ChevronRight, CircleHelp, Command, CreditCard,
  FileCode2, Folder, FolderGit2, Gauge, GitBranch, GitPullRequest, Globe2,
  HardDrive, Image as ImageIcon, Keyboard, Laptop, LogIn, LogOut, Menu,
  MessageSquarePlus, Mic, Monitor, Moon, Palette, Paperclip, Plug, Plus,
  Search, Settings, Sparkles, UserRound, Volume2, WandSparkles, X, Zap,
} from "lucide-react";

const prompts = ["What should we build?", "What do you want to work on?", "Where should we begin?", "What can Constella solve with you?"];

const models = [
  { id: "deepseek", name: "DeepSeek", version: "V4 Pro", color: "#5aa7ff", icon: "D", best: "Reasoning lead", summary: "Architecture, mathematics, logic, planning", tasks: ["Deep reasoning", "System architecture", "Math & logic", "Plan a complex task"] },
  { id: "codex", name: "Codex", version: "GPT-5.3", color: "#f3f3f3", icon: "C", best: "Engineering lead", summary: "Build, debug, review, ship", tasks: ["Write code", "Debug a problem", "Review a codebase", "Build a feature"] },
  { id: "gemini", name: "Gemini", version: "3.1 Pro", color: "#b38cff", icon: "G", best: "Multimodal lead", summary: "Research, images, video, long context", tasks: ["Generate an image", "Research the web", "Analyze media", "Explore a large document"] },
  { id: "claude", name: "Claude", version: "Sonnet 5", color: "#e99666", icon: "A", best: "Synthesis lead", summary: "Writing, analysis, nuanced communication", tasks: ["Write & refine", "Synthesize research", "Analyze a document", "Explain with clarity"] },
];

const settingsGroups = [
  { title: "Account", items: ["General", "Profile", "Appearance", "Voice configuration", "Personalization", "Keyboard shortcuts", "Usage", "Billing"] },
  { title: "Your account", items: ["App settings", "Plugins", "Browser", "Computer use", "Hooks", "Connections", "Git environments", "Worktrees"] },
];

export default function Home() {
  const [prompt, setPrompt] = useState(prompts[0]);
  const [message, setMessage] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState("General");
  const [signedIn, setSignedIn] = useState(true);
  const [attachOpen, setAttachOpen] = useState(false);
  const [plan, setPlan] = useState(true);
  const [sent, setSent] = useState(false);
  const [activeModel, setActiveModel] = useState<(typeof models)[number] | null>(null);
  const [roleStage, setRoleStage] = useState<"task" | "authority">("task");
  const [chosenTask, setChosenTask] = useState("");
  const [weights, setWeights] = useState<Record<string, number>>({ deepseek: 26, codex: 32, gemini: 20, claude: 22 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setPrompt(prompts[Math.floor(Math.random() * prompts.length)]), []);

  function submit() {
    if (!message.trim()) return;
    setSent(true);
    setTimeout(() => { setSent(false); setMessage(""); }, 1300);
  }

  function adjustModel(direction: "more" | "less") {
    if (!activeModel) return;
    setWeights((current) => {
      const change = direction === "more" ? 8 : -8;
      return { ...current, [activeModel.id]: Math.max(8, Math.min(65, current[activeModel.id] + change)) };
    });
    setActiveModel(null);
    setRoleStage("task");
  }

  function openSettings(target = "General") {
    setSection(target); setSettingsOpen(true); setProfileOpen(false);
  }

  return (
    <main className="constella-app">
      <aside className="side-rail">
        <div className="window-row"><i className="dot red"/><i className="dot yellow"/><i className="dot green"/><button aria-label="Toggle sidebar"><Menu size={15}/></button></div>
        <div className="rail-brand"><div className="brand-glyph"><Sparkles size={17}/></div><strong>Constella</strong><ChevronDown size={15}/><button className="rail-search" aria-label="Search"><Search size={17}/></button></div>
        <nav className="rail-nav">
          <button className="active"><MessageSquarePlus size={18}/>New chat</button>
          <button><Folder size={18}/>Projects</button>
          <button><GitPullRequest size={18}/>Pull requests</button>
          <button><Blocks size={18}/>Sites</button>
          <button><Bell size={18}/>Scheduled</button>
          <button onClick={() => openSettings("Plugins")}><Plug size={18}/>Plugins</button>
        </nav>
        <div className="rail-section"><span>Pinned</span>
          <button>Product launch command center</button><button>Constella orchestration ideas</button><button>Portfolio redesign</button>
        </div>
        <div className="rail-section recents"><span>Recents</span>
          <button className="selected">Build unified AI workspace</button><button>Fix onboarding experience</button><button>Research agent architecture</button><button>Marketing site concepts</button><button>Automate weekly reporting</button>
        </div>
        <div className="account-anchor">
          {profileOpen && signedIn && <div className="profile-menu">
            <div className="profile-menu-head"><div className="avatar">IS</div><div><strong>ishahryar</strong><span>ishahryar@constella.ai</span></div></div>
            <div className="usage-mini"><div><span>Monthly usage</span><b>68% left</b></div><div className="usage-track"><i/></div><small>Resets August 1</small></div>
            <button onClick={() => openSettings("General")}><Settings size={16}/>Settings</button>
            <button onClick={() => openSettings("Archived chats")}><Archive size={16}/>Archived chats</button>
            <button className="logout" onClick={() => { setSignedIn(false); setProfileOpen(false); }}><LogOut size={16}/>Log out</button>
          </div>}
          {!signedIn ? <button className="account-row signin" onClick={() => setSignedIn(true)}><LogIn size={17}/>Sign in to Constella</button> :
          <button className="account-row" onClick={() => setProfileOpen(!profileOpen)}><div className="avatar">IS</div><strong>ishahryar</strong><CircleHelp size={17}/></button>}
        </div>
      </aside>

      <section className="main-panel">
        <header className="main-topbar"><button><ArrowLeft size={17}/></button><div><strong>New chat</strong><span>Constella team active</span></div><div className="topbar-right"><span className="team-online"><i/>4 models coordinated</span><button><Command size={17}/></button></div></header>
        <div className="chat-stage">
          <div className="welcome">
            <div className="welcome-mark"><WandSparkles size={25}/></div>
            <h1>{prompt}</h1>
            <p>Constella quietly assembles the right team for the work.</p>
          </div>

          <div className="team-strip" aria-label="Constella model team">
            <div className="team-label"><Sparkles size={14}/><span><strong>Constella team</strong><small>Working as one intelligence</small></span></div>
            {models.map((model) => <button key={model.id} onClick={() => { setActiveModel(model); setRoleStage("task"); }}>
              <i style={{background:model.color, color:model.id === "codex" ? "#171717" : "#fff"}}>{model.icon}</i>
              <span><strong>{model.name}</strong><small>{model.best}</small></span><b>{weights[model.id]}%</b>
            </button>)}
          </div>

          <div className="composer-zone">
            {sent && <div className="route-toast"><Zap size={15}/>Constella is assigning the best lead and supporting models…</div>}
            <div className="composer-box">
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if(e.key === "Enter" && !e.shiftKey){e.preventDefault();submit();}}} placeholder="Do anything" aria-label="Message Constella" />
              <div className="composer-actions">
                <div className="attach-anchor"><button onClick={() => setAttachOpen(!attachOpen)} aria-label="Add files"><Plus size={20}/></button>{attachOpen && <div className="attach-pop"><button onClick={() => fileRef.current?.click()}><Paperclip size={16}/>Files</button><button onClick={() => fileRef.current?.click()}><Folder size={16}/>Folder</button><button><ImageIcon size={16}/>Image</button></div>}</div>
                <input hidden multiple type="file" ref={fileRef}/>
                <button className={plan ? "plan-active" : ""} onClick={() => setPlan(!plan)}><FileCode2 size={16}/>{plan ? "Plan on" : "Plan off"}</button>
                <div className="composer-spacer"/>
                <div className="unity-pill"><Sparkles size={14}/><span>Constella Auto</span><ChevronDown size={14}/></div>
                <button aria-label="Dictate"><Mic size={18}/></button>
                <button className="send" disabled={!message.trim()} onClick={submit}><ArrowUp size={18}/></button>
              </div>
            </div>
            <p className="composer-note">One account. One conversation. Every model contributes behind the scenes.</p>
          </div>
        </div>
      </section>

      {activeModel && <div className="model-control">
        <div className="model-control-head"><div className="model-avatar" style={{background:activeModel.color, color:activeModel.id === "codex" ? "#171717" : "#fff"}}>{activeModel.icon}</div><div><strong>{activeModel.name}</strong><span>{activeModel.version} · {activeModel.summary}</span></div><button onClick={() => setActiveModel(null)}><X size={16}/></button></div>
        {roleStage === "task" ? <><p>What should {activeModel.name} lead?</p><div className="task-grid">{activeModel.tasks.map(task => <button key={task} onClick={() => {setChosenTask(task);setRoleStage("authority");}}>{task}<ChevronRight size={14}/></button>)}</div></> : <><button className="back-step" onClick={() => setRoleStage("task")}><ArrowLeft size={14}/>{chosenTask}</button><p>How much authority should it have?</p><div className="authority-options"><button onClick={() => adjustModel("more")}><Gauge size={18}/><span><strong>Put more in charge</strong><small>{activeModel.name} leads; the other models advise and check.</small></span></button><button onClick={() => adjustModel("less")}><Bot size={18}/><span><strong>Put less in charge</strong><small>{activeModel.name} assists while Constella picks another lead.</small></span></button></div></>}
      </div>}

      {settingsOpen && <div className="modal-backdrop" onMouseDown={(e) => {if(e.target===e.currentTarget)setSettingsOpen(false)}}>
        <section className="settings-modal">
          <aside className="settings-nav"><div className="settings-title"><strong>Settings</strong><button onClick={() => setSettingsOpen(false)}><X size={17}/></button></div>
            {settingsGroups.map(group => <div key={group.title}><span>{group.title}</span>{group.items.map(item => <button className={section===item?"active":""} key={item} onClick={() => setSection(item)}>{settingIcon(item)}{item}</button>)}</div>)}
            <div><span>Chat history</span><button className={section==="Archived chats"?"active":""} onClick={() => setSection("Archived chats")}><Archive size={16}/>Archived chats</button></div>
          </aside>
          <div className="settings-content">{renderSettings(section, weights, setWeights)}</div>
        </section>
      </div>}
    </main>
  );
}

function settingIcon(item:string){
  const icons:Record<string,React.ReactNode>={General:<Settings size={16}/>,Profile:<UserRound size={16}/>,Appearance:<Palette size={16}/>,"Voice configuration":<Volume2 size={16}/>,Personalization:<Sparkles size={16}/>,"Keyboard shortcuts":<Keyboard size={16}/>,Usage:<BarChart3 size={16}/>,Billing:<CreditCard size={16}/>,"App settings":<Monitor size={16}/>,Plugins:<Plug size={16}/>,Browser:<Globe2 size={16}/>,"Computer use":<Laptop size={16}/>,Hooks:<GitBranch size={16}/>,Connections:<HardDrive size={16}/>,"Git environments":<FolderGit2 size={16}/>,Worktrees:<FolderGit2 size={16}/>}; return icons[item];
}

function renderSettings(section:string, weights:Record<string,number>, setWeights:React.Dispatch<React.SetStateAction<Record<string,number>>>){
  if(section==="Usage") return <><SettingsHeader title="Usage" subtitle="Your unified allowance across every Constella model."/><div className="usage-card"><div className="usage-ring"><span>68%</span><small>remaining</small></div><div><h3>Monthly intelligence</h3><p>All model activity is counted together—no separate provider accounts.</p><div className="usage-legend"><span><i className="u1"/>Reasoning 12%</span><span><i className="u2"/>Building 14%</span><span><i className="u3"/>Research 6%</span></div></div></div></>;
  if(section==="Archived chats") return <><SettingsHeader title="Archived chats" subtitle="Chats hidden from your sidebar stay available here."/><div className="archive-list"><article><div><strong>Early Constella naming ideas</strong><span>Archived July 21</span></div><button>Unarchive</button></article><article><div><strong>Travel planner prototype</strong><span>Archived July 17</span></div><button>Unarchive</button></article></div></>;
  if(section==="App settings") return <><SettingsHeader title="App settings" subtitle="Control how Constella’s model team works together."/><div className="model-settings"><h3>Model team</h3><p>All four models share the same conversation and account. Adjust their default influence.</p>{models.map(model=><div className="model-setting" key={model.id}><i style={{background:model.color,color:model.id==="codex"?"#171717":"white"}}>{model.icon}</i><div><strong>{model.name}</strong><span>{model.summary}</span></div><input aria-label={`${model.name} influence`} type="range" min="8" max="65" value={weights[model.id]} onChange={e=>setWeights(w=>({...w,[model.id]:Number(e.target.value)}))}/><b>{weights[model.id]}%</b></div>)}</div><div className="setting-row"><div><strong>Automatic lead selection</strong><span>Constella chooses a lead based on your task.</span></div><Toggle/></div><div className="setting-row"><div><strong>Cross-check important answers</strong><span>A second model quietly verifies critical work.</span></div><Toggle/></div></>;
  if(section==="Appearance") return <><SettingsHeader title="Appearance" subtitle="Make Constella feel at home on your device."/><div className="theme-grid"><button className="theme selected"><Moon size={22}/><span>Dark</span><Check size={15}/></button><button className="theme"><Monitor size={22}/><span>System</span></button><button className="theme light"><Sparkles size={22}/><span>Light</span></button></div></>;
  return <><SettingsHeader title={section} subtitle={`Manage your ${section.toLowerCase()} preferences in Constella.`}/><div className="setting-row"><div><strong>Use recommended settings</strong><span>Balanced defaults for the unified Constella experience.</span></div><Toggle/></div><div className="setting-row"><div><strong>Sync across devices</strong><span>Keep this preference with your Constella account.</span></div><Toggle/></div>{section==="General"&&<div className="model-settings overview"><h3>Your model team</h3><p>DeepSeek, Codex, Gemini, and Claude work inside Constella as one coordinated system. You never switch apps.</p>{models.map(model=><div className="model-setting" key={model.id}><i style={{background:model.color,color:model.id==="codex"?"#171717":"white"}}>{model.icon}</i><div><strong>{model.name}<em>{model.best}</em></strong><span>{model.summary}</span></div><Check size={16}/></div>)}</div>}</>;
}

function SettingsHeader({title,subtitle}:{title:string,subtitle:string}){return <header className="settings-header"><h2>{title}</h2><p>{subtitle}</p></header>}
function Toggle(){return <button className="toggle on" aria-label="Toggle setting"><i/></button>}
