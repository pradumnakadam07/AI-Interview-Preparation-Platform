import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { AudioLines, BarChart3, BookOpen, Clock3, LogOut, Moon, Plus, Sparkles, Sun, Code2 } from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { DashboardPage, DemoPage, HistoryPage, InterviewPage, LandingPage, AuthPage, ReportPage, SetupPage } from "./pages";
import { FundamentalsPage, FundamentalsTopicPage } from "./fundamentals/Pages";
const CodingPracticePage = lazy(() => import("./coding/CodingPracticePage").then(module => ({ default: module.CodingPracticePage })));
import "./platform.css";
import "./star.css";
import "./theme-polish.css";

function Guard({ children }: { children: React.ReactNode }) { return useAuth().user ? <>{children}</> : <Navigate to="/signin" replace/>; }

function Shell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [theme, setTheme] = useState<"light"|"dark">(() => localStorage.getItem("interviewlab-theme") === "dark" ? "dark" : "light");
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("interviewlab-theme", theme); }, [theme]);
  return <div className="platform-shell"><aside className="platform-sidebar"><Link className="platform-brand" to="/"><span className="platform-logo"><AudioLines size={19}/></span>interview<span className="brand-soft">lab</span></Link><div className="platform-side-label">WORKSPACE</div><nav className="platform-nav"><NavLink to="/practice"><Plus size={17}/> New interview</NavLink><NavLink to="/coding"><Code2 size={17}/> Coding practice</NavLink><NavLink to="/fundamentals"><BookOpen size={17}/> CS fundamentals</NavLink><NavLink to="/dashboard"><BarChart3 size={17}/> Dashboard</NavLink><NavLink to="/sessions"><Clock3 size={17}/> My sessions</NavLink></nav><div className="platform-sidebar-bottom"><div className="platform-side-promo"><span><Sparkles size={15}/></span><strong>Small steps add up.</strong><p>Build confidence one answer at a time.</p><Link to="/practice">Start a practice →</Link></div>{user?<div className="platform-user"><div className="platform-avatar">{user.name[0]?.toUpperCase()}</div><div><strong>{user.name}</strong><small>{user.email}</small></div><button onClick={signOut} aria-label="Sign out"><LogOut size={15}/></button></div>:<Link className="signin-hint" to="/signin">Sign in to save your progress →</Link>}</div></aside><main className="platform-main"><header className="platform-topbar"><span>InterviewLab <i>/</i> Practice workspace</span><div className="topbar-actions"><Link className="mobile-fundamentals-link" to="/fundamentals"><BookOpen size={15}/> Learn</Link><button className="theme-toggle" type="button" onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label={`Switch to ${theme==="dark"?"light":"dark"} mode`} title={`Switch to ${theme==="dark"?"light":"dark"} mode`}>{theme==="dark"?<Sun size={17}/>:<Moon size={17}/>}<span>{theme==="dark"?"Light mode":"Dark mode"}</span></button><Link to="/demo">Explore demo</Link></div></header>{children}</main></div>;
}

function RoutesView(){return <Suspense fallback={<div className="page-loading">Loading your practice workspace…</div>}><Routes><Route path="/" element={<LandingPage Shell={Shell}/>}/><Route path="/signin" element={<AuthPage Shell={Shell} mode="signin"/>}/><Route path="/signup" element={<AuthPage Shell={Shell} mode="signup"/>}/><Route path="/demo" element={<DemoPage Shell={Shell}/>}/><Route path="/practice" element={<Guard><SetupPage Shell={Shell}/></Guard>}/><Route path="/coding" element={<Guard><CodingPracticePage Shell={Shell}/></Guard>}/><Route path="/fundamentals" element={<Guard><FundamentalsPage Shell={Shell}/></Guard>}/><Route path="/fundamentals/:subjectId/:topicId" element={<Guard><FundamentalsTopicPage Shell={Shell}/></Guard>}/><Route path="/interview/:id" element={<Guard><InterviewPage Shell={Shell}/></Guard>}/><Route path="/sessions" element={<Guard><HistoryPage Shell={Shell}/></Guard>}/><Route path="/sessions/:id" element={<Guard><ReportPage Shell={Shell}/></Guard>}/><Route path="/dashboard" element={<Guard><DashboardPage Shell={Shell}/></Guard>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense>;}

export default function App(){return <AuthProvider><BrowserRouter><RoutesView/></BrowserRouter></AuthProvider>;}
