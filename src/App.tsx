import { useState, useEffect, useMemo, FormEvent } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  ShieldCheck, Search, Database, Layers, CheckCircle2, AlertTriangle, 
  XCircle, UploadCloud, ArrowRight, Activity, Users, Info, RefreshCw, FileText,
  Clock, Eye, Server, Award, ChevronRight, HelpCircle, Mail, Lock, Building2, Globe
} from 'lucide-react';
import { Material, MatchCandidate, CommonCodeMapping, AuditLogEntry, DashboardStats } from './types';
import { 
  fetchAllData, 
  sendReviewDecision, 
  sendCsvUpload, 
  sendBulkApprove, 
  sendResetDatabase 
} from './services/api';

export default function App() {
  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'discovery' | 'matching' | 'review' | 'mappings' | 'upload' | 'inventory' | 'audit' | 'admin-center'>('dashboard');
  
  // Authentication States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginRole, setLoginRole] = useState<'admin' | 'cpse'>('admin');
  const [loginCpse, setLoginCpse] = useState<string>('ONGC');
  const [authError, setAuthError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [adminConfigThreshold, setAdminConfigThreshold] = useState<number>(85);
  const [adminActionMsg, setAdminActionMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [adminApproving, setAdminApproving] = useState<boolean>(false);

  // Role toggler state
  const [role, setRole] = useState<'admin' | 'cpse'>('admin');
  const [selectedCpse, setSelectedCpse] = useState<string>('ONGC');

  // Application Data States
  const [materials, setMaterials] = useState<Material[]>([]);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [mappings, setMappings] = useState<CommonCodeMapping[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Discovery / Search States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchCategory, setSearchCategory] = useState<string>('ALL');

  // Human Review Active Pair State
  const [selectedMatch, setSelectedMatch] = useState<MatchCandidate | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Different Pressure Rating');
  const [customRejectReason, setCustomRejectReason] = useState<string>('');
  const [reviewActionMsg, setReviewActionMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Upload States
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Load state from backend with transparent browser engine fallback
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllData();

      setMaterials(data.materials);
      setMatches(data.matches);
      setMappings(data.mappings);
      setAuditLogs(data.auditLogs);
      setStats(data.stats);

      // Default selected match to first Needs Review pair if any
      const pending = data.matches.find((m: MatchCandidate) => m.status === 'NEEDS_REVIEW');
      if (pending) {
        setSelectedMatch(pending);
      } else if (data.matches.length > 0) {
        setSelectedMatch(data.matches[0]);
      } else {
        setSelectedMatch(null);
      }

    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError("Failed to sync with harmonization backend. Please check if server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handlers for Human Review Decisions
  const handleReviewDecision = async (action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO') => {
    if (!selectedMatch) return;

    const reason = action === 'REJECT' 
      ? (rejectReason === 'Other' ? customRejectReason : rejectReason)
      : action === 'NEEDS_INFO' ? 'Requested specification clarifications from participating CPSEs' : 'Verified standard equivalent match';

    try {
      const result = await sendReviewDecision({
        matchId: selectedMatch.id,
        action,
        reason,
        user: role === 'admin' ? 'Ministry Administrator' : `${selectedCpse} Liaison Officer`
      });

      if (result.success) {
        setReviewActionMsg({
          type: 'success',
          text: action === 'APPROVE' 
            ? `Successfully approved! assigned Common Code: ${result.commonCode}` 
            : action === 'REJECT' ? `Match rejected with reason: "${reason}"` : 'Match marked on hold (Needs More Info).'
        });
        
        // Remove toast after 5s
        setTimeout(() => setReviewActionMsg(null), 5000);
        
        // Re-fetch statistics and dataset mapping states
        await fetchData();
      } else {
        setReviewActionMsg({ type: 'error', text: result.error || 'Failed to persist decision.' });
      }
    } catch (err: any) {
      setReviewActionMsg({ type: 'error', text: 'Network error occurred.' });
    }
  };

  // Handler for custom CSV text submission
  const handleCsvUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!rawCsvText.trim()) return;

    setUploading(true);
    setUploadStatus(null);
    try {
      const result = await sendCsvUpload(rawCsvText);
      if (result.success) {
        setUploadStatus({
          type: 'success',
          msg: `Successfully parsed! Added ${result.addedCount} new unique CPSE materials. Match Candidates regenerated.`
        });
        setRawCsvText('');
        await fetchData();
      } else {
        setUploadStatus({ type: 'error', msg: result.error || 'Failed to load CSV.' });
      }
    } catch (err) {
      setUploadStatus({ type: 'error', msg: 'Failed to upload dataset.' });
    } finally {
      setUploading(false);
    }
  };

  // Handler to load sample duplicate CSV data
  const loadSampleUploadData = () => {
    const sample = `PSU_Name,Material_Code,Description,Specification,Unit_of_Measure,Category,HSN_Code
ONGC,ONGC-VALVE-701,Gate Valve 6 Inch Carbon Steel Class 150,Gate Valve CS ASTM A105 150LB RF,NOS,VALVES,84818030
IOCL,IOC-VALVE-702,Gate Valve 6 Inch CS 150# RF,6 inch Carbon Steel Gate Valve Class 150,NOS,VALVES,84818030
GAIL,GAIL-PIPE-401,MS Seamless Pipe 100mm NB Sch 40,Seamless Mild Steel Pipe Schedule 40 DN100,MTRS,PIPES,73041910
NTPC,NTPC-ELEC-805,Copper armored cable 3C x 16 Sqmm,Copper Cable Armoured 3 Core 16 sqmm 1.1KV,MTRS,ELECTRICAL,85444990`;
    setRawCsvText(sample);
  };

  // Handler to reset dataset to original seed
  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset the database to original seed? This will delete all pending approvals, custom records, and logs.")) return;
    setLoading(true);
    try {
      await sendResetDatabase();
      await fetchData();
      alert("Database reset completed.");
    } catch (err) {
      alert("Failed to reset database.");
    } finally {
      setLoading(false);
    }
  };

  // Authentication Handlers
  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!loginEmail || !loginEmail.includes('@') || !loginEmail.includes('.')) {
      setAuthError("Please enter a valid Gmail or work email address.");
      return;
    }
    if (!loginPassword || loginPassword.length < 4) {
      setAuthError("Password must be at least 4 characters long.");
      return;
    }

    setRole(loginRole);
    if (loginRole === 'cpse') {
      setSelectedCpse(loginCpse);
    }
    setUserEmail(loginEmail);
    setIsLoggedIn(true);
    setAuthError(null);
    setActiveTab('dashboard');
  };

  const handleQuickLogin = (selectedType: 'admin' | 'cpse', cpseName?: string) => {
    setAuthError(null);
    if (selectedType === 'admin') {
      setRole('admin');
      setUserEmail('sih.admin@ministry.gov.in');
      setIsLoggedIn(true);
      setActiveTab('dashboard');
    } else {
      setRole('cpse');
      const selected = cpseName || 'ONGC';
      setSelectedCpse(selected);
      setUserEmail(`${selected.toLowerCase().replace(/\s+/g, '')}.liaison@cpse.gov.in`);
      setIsLoggedIn(true);
      setActiveTab('dashboard');
    }
  };

  const handleBulkApprove = async () => {
    setAdminApproving(true);
    setAdminActionMsg(null);
    try {
      const result = await sendBulkApprove(adminConfigThreshold);
      if (result.success) {
        setAdminActionMsg({
          type: 'success',
          text: `Administrative Batch Harmonization Successful! Automatically approved and linked ${result.approvedCount} high-confidence duplicates.`
        });
        await fetchData();
      } else {
        setAdminActionMsg({ type: 'error', text: result.error || 'Failed to execute batch process.' });
      }
    } catch (err) {
      setAdminActionMsg({ type: 'error', text: 'Network connection failed.' });
    } finally {
      setAdminApproving(false);
    }
  };

  // Pagination and Filter States for ultra-smooth 60fps performance
  const [discoveryPage, setDiscoveryPage] = useState<number>(1);
  const [matchingPage, setMatchingPage] = useState<number>(1);
  const [matchingFilterStatus, setMatchingFilterStatus] = useState<string>('ALL');
  const [matchingFilterCat, setMatchingFilterCat] = useState<string>('ALL');
  const [matchingSearchQuery, setMatchingSearchQuery] = useState<string>('');
  const [mappingsPage, setMappingsPage] = useState<number>(1);
  const [mappingsSearchQuery, setMappingsSearchQuery] = useState<string>('');
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  const DISCOVERY_PER_PAGE = 12;
  const MATCHING_PER_PAGE = 10;
  const MAPPINGS_PER_PAGE = 15;
  const AUDIT_PER_PAGE = 15;

  // Cross-CPSE Discovery Filtering with Pagination
  const filteredDiscoveryMaterials = useMemo(() => {
    return materials.filter(m => {
      const matchesSearch = !searchQuery || 
        m.Description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.Material_Code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.Specification.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.HSN_Code.includes(searchQuery);
      
      const matchesCategory = searchCategory === 'ALL' || m.Category === searchCategory;
      return matchesSearch && matchesCategory;
    });
  }, [materials, searchQuery, searchCategory]);

  const totalDiscoveryPages = Math.max(1, Math.ceil(filteredDiscoveryMaterials.length / DISCOVERY_PER_PAGE));
  const paginatedDiscoveryMaterials = useMemo(() => {
    const start = (discoveryPage - 1) * DISCOVERY_PER_PAGE;
    return filteredDiscoveryMaterials.slice(start, start + DISCOVERY_PER_PAGE);
  }, [filteredDiscoveryMaterials, discoveryPage]);

  // Fast O(1) Hash Map indices for instant cross-CPSE lookups without lag
  const mappingByCode = useMemo(() => {
    const map = new Map<string, CommonCodeMapping>();
    for (const m of mappings) {
      for (const lm of m.linkedMaterials) {
        map.set(lm.Material_Code, m);
      }
    }
    return map;
  }, [mappings]);

  const strongMatchesByCode = useMemo(() => {
    const map = new Map<string, MatchCandidate[]>();
    for (const match of matches) {
      if (match.status !== 'STRONG_MATCH') continue;
      const m1Code = match.material1.Material_Code;
      const m2Code = match.material2.Material_Code;
      if (!map.has(m1Code)) map.set(m1Code, []);
      if (!map.has(m2Code)) map.set(m2Code, []);
      map.get(m1Code)!.push(match);
      map.get(m2Code)!.push(match);
    }
    return map;
  }, [matches]);

  // Instant O(1) lookup
  const getLinkedCpseMaterials = (item: Material) => {
    const mapping = mappingByCode.get(item.Material_Code);
    if (mapping) {
      return {
        commonCode: mapping.commonCode,
        isHarmonized: true,
        links: mapping.linkedMaterials.filter(lm => lm.Material_Code !== item.Material_Code)
      };
    }

    const strongMatches = strongMatchesByCode.get(item.Material_Code) || [];
    const matchLinks = strongMatches.map(match => {
      const other = match.material1.Material_Code === item.Material_Code ? match.material2 : match.material1;
      return {
        PSU_Name: other.PSU_Name,
        Material_Code: other.Material_Code,
        Description: other.Description,
        confidence: match.confidence,
        status: match.status
      };
    });

    return {
      commonCode: "NOT HARMONIZED YET",
      isHarmonized: false,
      links: matchLinks
    };
  };

  // Filtered & Paginated Matches
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const matchesStatus = matchingFilterStatus === 'ALL' || m.status === matchingFilterStatus;
      const matchesCategory = matchingFilterCat === 'ALL' || m.material1.Category === matchingFilterCat || m.material2.Category === matchingFilterCat;
      const matchesSearch = !matchingSearchQuery ||
        m.material1.Description.toLowerCase().includes(matchingSearchQuery.toLowerCase()) ||
        m.material2.Description.toLowerCase().includes(matchingSearchQuery.toLowerCase()) ||
        m.material1.Material_Code.toLowerCase().includes(matchingSearchQuery.toLowerCase()) ||
        m.material2.Material_Code.toLowerCase().includes(matchingSearchQuery.toLowerCase());
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [matches, matchingFilterStatus, matchingFilterCat, matchingSearchQuery]);

  const totalMatchingPages = Math.max(1, Math.ceil(filteredMatches.length / MATCHING_PER_PAGE));
  const paginatedMatches = useMemo(() => {
    const start = (matchingPage - 1) * MATCHING_PER_PAGE;
    return filteredMatches.slice(start, start + MATCHING_PER_PAGE);
  }, [filteredMatches, matchingPage]);

  // Filtered & Paginated Mappings
  const filteredMappings = useMemo(() => {
    return mappings.filter(m => {
      if (!mappingsSearchQuery) return true;
      const q = mappingsSearchQuery.toLowerCase();
      return m.commonCode.toLowerCase().includes(q) ||
        m.standardDescription.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.linkedMaterials.some(lm => lm.PSU_Name.toLowerCase().includes(q) || lm.Material_Code.toLowerCase().includes(q) || lm.Description.toLowerCase().includes(q));
    });
  }, [mappings, mappingsSearchQuery]);

  const totalMappingsPages = Math.max(1, Math.ceil(filteredMappings.length / MAPPINGS_PER_PAGE));
  const paginatedMappings = useMemo(() => {
    const start = (mappingsPage - 1) * MAPPINGS_PER_PAGE;
    return filteredMappings.slice(start, start + MAPPINGS_PER_PAGE);
  }, [filteredMappings, mappingsPage]);

  // Filtered & Paginated Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (!auditSearchQuery) return true;
      const q = auditSearchQuery.toLowerCase();
      return log.id.toLowerCase().includes(q) ||
        log.user.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.material1Code.toLowerCase().includes(q) ||
        log.material2Code.toLowerCase().includes(q) ||
        log.material1Desc.toLowerCase().includes(q) ||
        log.material2Desc.toLowerCase().includes(q) ||
        log.finalDecision.toLowerCase().includes(q);
    });
  }, [auditLogs, auditSearchQuery]);

  const totalAuditPages = Math.max(1, Math.ceil(filteredAuditLogs.length / AUDIT_PER_PAGE));
  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * AUDIT_PER_PAGE;
    return filteredAuditLogs.slice(start, start + AUDIT_PER_PAGE);
  }, [filteredAuditLogs, auditPage]);

  // Categories list
  const categories = ["ALL", "PIPES", "VALVES", "ELECTRICAL", "FITTINGS", "PUMPS", "FLANGES", "GASKETS", "INSTRUMENTATION"];

  // Custom colors for charts
  const COLORS = ['#1e3a8a', '#0d9488', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  if (loading && materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <RefreshCw className="w-12 h-12 text-blue-900 animate-spin mb-4" />
        <h3 className="text-xl font-semibold text-slate-800">Booting Harmonization Engine...</h3>
        <p className="text-slate-500 mt-2 text-sm">Precomputing TF-IDF Vectors and Cosine Similarities (~1,200 records)</p>
      </div>
    );
  }

  // --- SECURE LOGIN PORTAL OVERLAY ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-screen flex flex-col md:flex-row bg-[#001529] font-sans text-slate-100 overflow-y-auto selection:bg-blue-900 selection:text-white">
        
        {/* Left Column: Vision & Brand Illustration */}
        <div className="hidden md:flex md:w-5/12 bg-gradient-to-br from-[#001c38] to-[#001224] p-12 flex-col justify-between border-r border-slate-800 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-12 -translate-y-12"></div>
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center font-black text-white text-2xl shadow-md">
              M
            </div>
            <div>
              <span className="text-white font-extrabold text-xl tracking-tight block">MaterialSync AI</span>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest block">National Standardization Portal</span>
            </div>
          </div>
          
          <div className="space-y-6 relative z-10 my-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Standardization Framework Status: Operational</span>
            </div>
            <h2 className="text-4xl font-extrabold leading-tight text-white">
              Standardizing CPSE Material Catalogs, <br />
              <span className="text-blue-400">Preserving Operational Autonomy.</span>
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md">
              MaterialSync AI serves as a high-velocity, semantic-technical mapping layer on top of your existing ERP & SAP systems.
              No need to alter internal codes. Harmonize, identify, and exchange resources nation-wide.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/60 max-w-sm">
              <div>
                <p className="text-white font-bold text-lg">6 Active</p>
                <p className="text-xs text-slate-500">Major Oil & Gas PSUs</p>
              </div>
              <div>
                <p className="text-white font-bold text-lg">8+ Core</p>
                <p className="text-xs text-slate-500">Technical Categories</p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-800/80 pt-6 relative z-10">
            <div className="flex gap-4 items-center">
              <div className="flex -space-x-2">
                <span className="w-8 h-8 rounded-full bg-blue-900 border border-slate-800 flex items-center justify-center text-[9px] font-black">ONGC</span>
                <span className="w-8 h-8 rounded-full bg-teal-900 border border-slate-800 flex items-center justify-center text-[9px] font-black">IOCL</span>
                <span className="w-8 h-8 rounded-full bg-indigo-900 border border-slate-800 flex items-center justify-center text-[9px] font-black">GAIL</span>
                <span className="w-8 h-8 rounded-full bg-slate-800 border border-slate-800 flex items-center justify-center text-[9px] font-black">NTPC</span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">Approved by MoP&NG / Ministry of Power</span>
            </div>
          </div>
        </div>
        
        {/* Right Column: Interactive Login form & Presentation Profile Selector */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:p-20 bg-slate-950">
          <div className="w-full max-w-md space-y-8">
            
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-3xl font-black text-white tracking-tight">Access National Portal</h3>
              <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                Log in with your ministry admin credentials or your designated CPSE Liaison profile.
              </p>
            </div>
            
            {authError && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-xs flex items-center gap-2 font-semibold animate-shake">
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            
            <form onSubmit={handleLogin} className="space-y-5">
              
              {/* Access Role Tab Toggles */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Access Portal Persona</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLoginRole('admin')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                      loginRole === 'admin'
                        ? 'bg-blue-600/15 border-blue-500 text-blue-400 font-extrabold shadow-sm'
                        : 'bg-slate-900 border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Ministry Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginRole('cpse')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                      loginRole === 'cpse'
                        ? 'bg-teal-600/15 border-teal-500 text-teal-400 font-extrabold shadow-sm'
                        : 'bg-slate-900 border-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    CPSE User
                  </button>
                </div>
              </div>

              {/* CPSE Organization dropdown */}
              {loginRole === 'cpse' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">Select Liaison Authority</label>
                  <select
                    value={loginCpse}
                    onChange={(e) => setLoginCpse(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-semibold text-slate-200 focus:outline-hidden focus:border-slate-700 focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="ONGC">ONGC (Oil & Natural Gas Corporation)</option>
                    <option value="IOCL">IOCL (Indian Oil Corporation Ltd)</option>
                    <option value="NTPC">NTPC (National Thermal Power Corp)</option>
                    <option value="GAIL">GAIL (Gas Authority of India Ltd)</option>
                    <option value="BHEL">BHEL (Bharat Heavy Electricals Ltd)</option>
                    <option value="BPCL">BPCL (Bharat Petroleum Corp Ltd)</option>
                  </select>
                </div>
              )}
              
              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">Gmail or Corporate Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder={loginRole === 'admin' ? "sih.admin@ministry.gov.in" : "liaison@ongc.gov.in"}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-200 placeholder:text-slate-700 focus:outline-hidden focus:border-slate-700"
                  />
                </div>
              </div>
              
              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-wider">Portal Access Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-200 placeholder:text-slate-700 focus:outline-hidden focus:border-slate-700"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  loginRole === 'admin'
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/50'
                    : 'bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-950/50'
                }`}
              >
                Sign In to Platform
              </button>
            </form>
            
            {/* Quick-Access Demo Profiles Panel */}
            <div className="border-t border-slate-900 pt-6">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">Quick-Access Demo Profiles (For PPT & Live Presentation)</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleQuickLogin('admin')}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-xs text-blue-400 font-bold border border-blue-950/40 text-left flex flex-col justify-between h-16 transition-all"
                >
                  <span className="uppercase text-[8px] text-slate-500 font-bold block">Ministry Admin view</span>
                  <span className="truncate font-black text-[10px]">sih.admin@gov.in</span>
                </button>
                <button
                  onClick={() => handleQuickLogin('cpse', 'ONGC')}
                  className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-xs text-teal-400 font-bold border border-teal-950/40 text-left flex flex-col justify-between h-16 transition-all"
                >
                  <span className="uppercase text-[8px] text-slate-500 font-bold block">ONGC Liaison view</span>
                  <span className="truncate font-black text-[10px]">ongc.liaison@cpse.gov.in</span>
                </button>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden selection:bg-blue-100">
      
      {/* ----------------- SLEEK NAVIGATION SIDEBAR ----------------- */}
      <nav className="w-64 bg-[#001529] flex flex-col flex-shrink-0 h-full text-slate-300 z-20">
        
        {/* Logo and Title */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold text-white text-xl flex-shrink-0">
            M
          </div>
          <div>
            <span className="text-white font-bold text-base tracking-tight block">MaterialSync AI</span>
            <span className="text-[9px] text-blue-400 font-semibold uppercase tracking-widest block">National Portal</span>
          </div>
        </div>

        {/* Sidebar Tabs List */}
        <div className="flex-1 px-4 space-y-1 py-6 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard Overview', icon: Activity },
            ...(role === 'admin' ? [{ id: 'admin-center', label: 'Ministry Control Center', icon: ShieldCheck }] : []),
            { id: 'discovery', label: 'CPSE Discovery', icon: Search },
            { id: 'matching', label: 'AI Match Results', icon: Layers, badge: matches.length },
            { id: 'review', label: 'Human Review Center', icon: ShieldCheck },
            { id: 'mappings', label: 'Material Registry', icon: Database, badge: mappings.length },
            { id: 'upload', label: 'Dataset & Ingestion', icon: UploadCloud },
            { id: 'inventory', label: 'Surplus Inventory', icon: Server },
            { id: 'audit', label: 'System Audit Trail', icon: FileText, badge: auditLogs.length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setReviewActionMsg(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-md transition-all text-left ${
                  isActive
                    ? 'text-white bg-blue-600/20 border-l-4 border-blue-500 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`ml-auto px-2 py-0.5 text-[10px] rounded-full font-bold ${
                    isActive ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer Role Card */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-3">
          <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Active Persona</p>
            <p className="text-xs text-white mt-0.5 font-bold">
              {role === 'admin' ? 'National Administrator' : `${selectedCpse} Liaison Officer`}
            </p>
            {userEmail && (
              <p className="text-[10px] text-blue-300 truncate mt-1">{userEmail}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] text-slate-300 font-semibold">6 PSUs Synced Live</span>
            </div>
          </div>
          
          <button
            onClick={() => {
              setIsLoggedIn(false);
              setUserEmail('');
              setLoginEmail('');
              setLoginPassword('');
            }}
            className="w-full py-1.5 px-3 rounded-md bg-red-950/40 hover:bg-red-900/30 text-red-400 border border-red-900/30 text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            Sign Out of Portal
          </button>
        </div>
      </nav>

      {/* ----------------- MAIN COLUMN ----------------- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Sticky Header with Controls */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 z-10 shadow-xs">
          
          {/* Breadcrumb Info */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>National Framework</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 font-semibold uppercase tracking-wider text-[11px]">
                {activeTab === 'dashboard' && 'Harmonization Dashboard'}
                {activeTab === 'admin-center' && 'Ministry Admin Control Center'}
                {activeTab === 'discovery' && 'CPSE Catalog Discovery'}
                {activeTab === 'matching' && 'AI Similarity Matching'}
                {activeTab === 'review' && 'Human Decision & Registry Approval'}
                {activeTab === 'mappings' && 'Common Code Mappings'}
                {activeTab === 'upload' && 'Dataset Ingest & Custom Seed'}
                {activeTab === 'inventory' && 'Inter-CPSE Spare Stock Sharing'}
                {activeTab === 'audit' && 'Cryptographic System Audit Logs'}
              </span>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-4">
            
            {/* Database Reset */}
            <button 
              onClick={handleReset}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition flex items-center gap-1 text-xs font-semibold"
              title="Reset Database to Seed State"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Reset Database</span>
            </button>

            {/* Authenticated Persona Profile Tag */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider hidden md:inline">Logged In:</span>
              <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border flex items-center gap-1.5 uppercase ${
                role === 'admin' 
                  ? 'bg-blue-50 text-blue-900 border-blue-100' 
                  : 'bg-teal-50 text-teal-900 border-teal-100'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5 text-current shrink-0" />
                {role === 'admin' ? 'Ministry Admin' : `${selectedCpse} Liaison`}
              </span>
            </div>

          </div>
        </header>

        {/* ----------------- SCROLLABLE CONTENT BODY ----------------- */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          
          {/* Governance Notice Alert bar at top of scroll body */}
          <div className="mb-6 p-4 bg-blue-950 text-white rounded-xl border border-blue-900 flex flex-col md:flex-row justify-between items-center gap-2 shadow-sm shrink-0">
            <div className="flex items-center gap-2 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>National Material Harmonization & Standardization Framework</span>
            </div>
            <div className="text-center md:text-right text-blue-200 text-[10px] max-w-2xl italic leading-tight">
              Standardizing material identity dynamically. CPSEs retain absolute control over internal procurement and surplus warehouse data.
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-3 text-sm">
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
              <div>{error}</div>
            </div>
          )}

        {/* ----------------- 1. DASHBOARD VIEW ----------------- */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Materials</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">{stats.totalMaterials.toLocaleString()}</h3>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-[11px] text-blue-700 font-semibold">
                  <Database className="w-3.5 h-3.5" />
                  <span>Across 6 Active CPSEs</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Participating CPSEs</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">{stats.participatingCPSEs}</h3>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-[11px] text-emerald-700 font-semibold">
                  <Users className="w-3.5 h-3.5" />
                  <span>Standardized Integration</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Potential Match Pairs</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">{stats.potentialMatchesCount}</h3>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-[11px] text-indigo-700 font-semibold">
                  <Activity className="w-3.5 h-3.5" />
                  <span>AI Precomputed (Cosine &ge;0.70)</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Approved Common Codes</p>
                  <h3 className="text-2xl font-black text-slate-800 mt-1">{stats.approvedCommonCodesCount}</h3>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-[11px] text-emerald-700 font-semibold">
                  <Award className="w-3.5 h-3.5" />
                  <span>Common Registry Mapping</span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between bg-amber-50/50 border-amber-200">
                <div>
                  <p className="text-xs font-medium text-amber-800 uppercase tracking-wider">Pending Human Review</p>
                  <h3 className="text-2xl font-black text-amber-900 mt-1">{stats.pendingReviewCount}</h3>
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-[11px] text-amber-800 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Awaiting Decision</span>
                </div>
              </div>

            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Chart 1: Materials by CPSE */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-800 text-sm">Material Contribution by CPSE / PSU</h4>
                  <span className="text-[10px] text-slate-400 font-medium">Unified DB Distribution</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.materialsByCPSE} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                      <Bar dataKey="value" fill="#1e3a8a" radius={[4, 4, 0, 0]}>
                        {stats.materialsByCPSE.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Materials by Category */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-800 text-sm">Materials Category Distribution</h4>
                  <span className="text-[10px] text-slate-400 font-medium">8 Standardized Portfolios</span>
                </div>
                <div className="h-64 flex flex-col md:flex-row items-center justify-center">
                  <div className="w-full md:w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.materialsByCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {stats.materialsByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 grid grid-cols-2 gap-2 pl-4">
                    {stats.materialsByCategory.map((item, idx) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="text-[10px] font-semibold text-slate-600 truncate" title={item.name}>{item.name} ({item.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Governance Info Panel */}
            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
              <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-900" />
                Inter-CPSE Material Code Harmonization Framework
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600 leading-relaxed">
                <div>
                  <h5 className="font-bold text-slate-800 mb-1">Non-Intrusive Integration Layer</h5>
                  <p>MaterialSync AI functions strictly as a mapping layer on top of active SAP/ERP configurations. Original material codes, procurement processes, and internal supply chain pipelines are never overwritten or altered.</p>
                </div>
                <div>
                  <h5 className="font-bold text-slate-800 mb-1">Semantic Attribute Matching Pipeline</h5>
                  <p>Matches are precomputed across descriptions using advanced regex attribute extraction combined with high-performance string TF-IDF vector models, eliminating manual categorization and error-prone cross-referencing.</p>
                </div>
                <div>
                  <h5 className="font-bold text-slate-800 mb-1">CPSE Controlled Sharing</h5>
                  <p>Original CPSE inventories remain private. Real-time sharing of active surpluses or operational inventory is completely optional, sandbox-isolated, and managed exclusively under individual CPSE policies.</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ----------------- MINISTRY ADMIN CONTROL CENTER ----------------- */}
        {activeTab === 'admin-center' && role === 'admin' && (
          <div className="space-y-6">
            
            {/* Banner overview */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-900 shrink-0" />
                National Material Standard Integration Panel
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                As a National Ministry Administrator, you have authorization to define the standardization similarity logic, bulk-approve matching pools, and monitor real-time database heartbeats from the 6 participating public sector enterprises.
              </p>
            </div>

            {/* Core Action Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Threshold & Bulk Action Panel */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Automated Batch Harmonization Engine</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">Define criteria for bulk-creating Common National Material Codes</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                      High Velocity API
                    </span>
                  </div>

                  {adminActionMsg && (
                    <div className={`p-4 rounded-lg text-xs font-semibold mb-4 border ${
                      adminActionMsg.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      {adminActionMsg.text}
                    </div>
                  )}

                  <div className="space-y-5">
                    {/* Range Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">Similarity Match Cutoff Threshold</span>
                        <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 text-sm">{adminConfigThreshold}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="50" 
                        max="95" 
                        step="5"
                        value={adminConfigThreshold}
                        onChange={(e) => {
                          setAdminConfigThreshold(Number(e.target.value));
                          setAdminActionMsg(null);
                        }}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-1">
                        <span>50% (Permissive)</span>
                        <span>75% (Standard Default)</span>
                        <span>95% (Extreme Accuracy Only)</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
                      <p className="font-bold text-slate-700">What happens during batch approval?</p>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                        <li>The system queries the current active <span className="font-bold text-slate-800">{matches.length} pending candidate duplicates</span>.</li>
                        <li>It filters for candidates with an AI similarity score <span className="font-bold text-slate-800">equal or greater than {adminConfigThreshold}%</span>.</li>
                        <li>It verifies there are <span className="font-bold text-slate-800">0 critical technical mismatches</span> detected on category features.</li>
                        <li>It automatically links them to unique <span className="font-bold text-slate-800">NMC Common Codes</span> and records them in the audit trail.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    onClick={handleBulkApprove}
                    disabled={adminApproving || matches.length === 0}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-900/10 flex items-center gap-2"
                  >
                    {adminApproving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Processing Mappings...
                      </>
                    ) : (
                      <>
                        Execute Batch Harmonization ({matches.filter(m => m.confidence >= adminConfigThreshold).length} items)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Cryptographic Registry Info & System Integrity */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-800 shrink-0" />
                    Registry Integrity Ledger
                  </h4>
                  <div className="space-y-4 text-xs">
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-indigo-900 font-bold">Standardization Authority</span>
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-green-100 text-green-900 rounded-md">VERIFIED</span>
                      </div>
                      <p className="text-[11px] text-indigo-700 leading-tight">
                        MoP&NG Technical Standardization Cell, Government of India
                      </p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Blockchain/Genesis Seed Hash</span>
                      <p className="font-mono text-[9px] bg-slate-50 p-2 rounded-lg border border-slate-200 break-all text-slate-600 leading-tight">
                        e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                        <span>Database Sync Protocol:</span>
                        <span className="font-bold text-slate-800">REST over VPN (RFC 2547)</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                        <span>Security Standard:</span>
                        <span className="font-bold text-slate-800">ISO/IEC 27001 Certified</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                        <span>Liaison Sync Loop:</span>
                        <span className="font-bold text-slate-800">120 Seconds Cron</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-6 flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ledger Active & Intact</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">v1.12.0</span>
                </div>
              </div>

            </div>

            {/* CPSE Connection Monitor Heartbeats */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-800" />
                    CPSE SAP ERP Connection Monitor
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Active enterprise database tunnels, uptime, and last mapped replication stats</p>
                </div>
                <span className="px-2 py-0.5 text-[10px] bg-green-50 text-green-700 border border-green-200 font-black rounded-lg">
                  6/6 Connected
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { name: "ONGC", uptime: "99.98%", ping: "12ms", dbSize: "45,210 items", sync: "3m ago", type: "SAP RFC Connector" },
                  { name: "IOCL", uptime: "99.92%", ping: "18ms", dbSize: "38,512 items", sync: "12m ago", type: "Oracle DBLink" },
                  { name: "GAIL", uptime: "100.00%", ping: "15ms", dbSize: "12,985 items", sync: "Just now", type: "REST Webhook" },
                  { name: "NTPC", uptime: "99.85%", ping: "24ms", dbSize: "22,410 items", sync: "1h ago", type: "SAP RFC Connector" },
                  { name: "BHEL", uptime: "99.95%", ping: "29ms", dbSize: "18,450 items", sync: "5m ago", type: "SQL Server Linked" },
                  { name: "BPCL", uptime: "99.91%", ping: "16ms", dbSize: "15,220 items", sync: "10m ago", type: "REST Webhook" }
                ].map((cpse) => (
                  <div key={cpse.name} className="p-3.5 bg-slate-50/50 border border-slate-200 rounded-xl flex flex-col justify-between hover:border-slate-300 transition-all">
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-black text-slate-800 text-xs">{cpse.name}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-0.5">{cpse.type}</p>
                    </div>

                    <div className="mt-4 space-y-1 border-t border-slate-200/50 pt-2 text-[10px]">
                      <div className="flex justify-between text-slate-500">
                        <span>Uptime:</span>
                        <span className="font-semibold text-slate-800">{cpse.uptime}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Latency:</span>
                        <span className="font-semibold text-slate-800">{cpse.ping}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Replicated:</span>
                        <span className="font-semibold text-slate-800 truncate max-w-[50px]" title={cpse.dbSize}>{cpse.dbSize}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Last sync:</span>
                        <span className="font-bold text-blue-600">{cpse.sync}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ----------------- 2. CROSS-CPSE DISCOVERY ----------------- */}
        {activeTab === 'discovery' && (
          <div className="space-y-6">
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-800 mb-2">Cross-CPSE Material Equivalent Search</h3>
              <p className="text-xs text-slate-500 mb-4">Input descriptions, material codes, or HSN codes to instantly discover duplicate equivalents or mapped assets across other Central Public Sector Enterprises.</p>
              
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setDiscoveryPage(1);
                    }}
                    placeholder="Search by code or description (e.g., 'Gate Valve', 'Pipe 100mm', 'ONGC-PIPE-001')..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-900 focus:bg-white transition-all font-semibold"
                  />
                </div>
                
                <div className="w-full md:w-48">
                  <select
                    value={searchCategory}
                    onChange={(e) => {
                      setSearchCategory(e.target.value);
                      setDiscoveryPage(1);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg p-2.5 font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-900"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat === 'ALL' ? 'All Categories' : cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Discovery Results */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Matches & Candidates found ({filteredDiscoveryMaterials.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Page {discoveryPage} of {totalDiscoveryPages}
                </span>
              </div>

              {filteredDiscoveryMaterials.length === 0 ? (
                <div className="bg-white p-12 text-center border border-slate-200 rounded-xl">
                  <p className="text-sm text-slate-500">No matching materials found for current search filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {paginatedDiscoveryMaterials.map((item) => {
                    const statusInfo = getLinkedCpseMaterials(item);
                    return (
                      <div key={item.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-all flex flex-col md:flex-row justify-between gap-4">
                        
                        {/* Primary Record */}
                        <div className="space-y-2 max-w-2xl">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-900">
                              {item.PSU_Name}
                            </span>
                            <span className="text-xs text-slate-400 font-bold tracking-wider uppercase">
                              {item.Material_Code}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                              {item.Category}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-800 leading-tight">{item.Description}</h4>
                          <div className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">Specification:</span> {item.Specification || "N/A"}
                          </div>
                          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                            <span>UOM: {item.Unit_of_Measure}</span>
                            <span>HSN Code: {item.HSN_Code || "N/A"}</span>
                          </div>
                        </div>

                        {/* Equivalents in Other CPSEs */}
                        <div className="md:w-96 bg-slate-50 p-4 rounded-lg border border-slate-150 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-2.5">
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Equivalent Equivalents</span>
                              {statusInfo.isHarmonized ? (
                                <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded text-[9px] font-bold tracking-tight">
                                  {statusInfo.commonCode}
                                </span>
                              ) : (
                                <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-[9px] font-bold tracking-tight">
                                  Match Candidate
                                </span>
                              )}
                            </div>

                            {statusInfo.links.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic">No equivalent material found in other CPSEs.</p>
                            ) : (
                              <div className="space-y-2">
                                {statusInfo.links.map((link: any, idx) => (
                                  <div key={idx} className="border-b border-slate-200 pb-1.5 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                      <span className="text-teal-700">{link.PSU_Name}</span>
                                      <span className="text-slate-400">({link.Material_Code})</span>
                                      {link.confidence && (
                                        <span className="ml-auto text-slate-500">{link.confidence}% Confidence</span>
                                      )}
                                    </div>
                                    <p className="text-[11px] font-semibold text-slate-700 truncate">{link.Description}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Quick review action link */}
                          {!statusInfo.isHarmonized && statusInfo.links.length > 0 && (
                            <button
                              onClick={() => {
                                const foundMatch = matches.find(m => 
                                  m.material1.Material_Code === item.Material_Code || 
                                  m.material2.Material_Code === item.Material_Code
                                );
                                if (foundMatch) {
                                  setSelectedMatch(foundMatch);
                                  setActiveTab('review');
                                } else {
                                  alert("This item matches, but is already approved or cleared.");
                                }
                              }}
                              className="mt-3 text-[11px] font-bold text-blue-900 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                            >
                              Open in Decision Center <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* Discovery Pagination Bar */}
              {totalDiscoveryPages > 1 && (
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 mt-4 text-xs">
                  <button
                    onClick={() => setDiscoveryPage(p => Math.max(1, p - 1))}
                    disabled={discoveryPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                  >
                    Previous
                  </button>
                  <span className="text-slate-500 font-semibold">
                    Page {discoveryPage} of {totalDiscoveryPages} ({filteredDiscoveryMaterials.length} materials)
                  </span>
                  <button
                    onClick={() => setDiscoveryPage(p => Math.min(totalDiscoveryPages, p + 1))}
                    disabled={discoveryPage === totalDiscoveryPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ----------------- 3. AI MATCHING RESULTS VIEW ----------------- */}
        {activeTab === 'matching' && (
          <div className="space-y-6">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">AI-Driven Pairwise Match Candidates</h3>
                <p className="text-xs text-slate-500">
                  The harmonization engine automatically evaluates pairs of materials inside standard categories. High scoring pairings are proposed for Human Review.
                </p>
              </div>

              {/* Match Filter & Search Toolbar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={matchingSearchQuery}
                    onChange={(e) => {
                      setMatchingSearchQuery(e.target.value);
                      setMatchingPage(1);
                    }}
                    placeholder="Search match descriptions/codes..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-hidden font-medium"
                  />
                </div>

                <div>
                  <select
                    value={matchingFilterStatus}
                    onChange={(e) => {
                      setMatchingFilterStatus(e.target.value);
                      setMatchingPage(1);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg p-2 font-semibold text-slate-700 focus:outline-hidden"
                  >
                    <option value="ALL">All Statuses ({matches.length})</option>
                    <option value="STRONG_MATCH">Strong Matches (&ge;80%) ({matches.filter(m => m.status === 'STRONG_MATCH').length})</option>
                    <option value="NEEDS_REVIEW">Needs Review (65-79%) ({matches.filter(m => m.status === 'NEEDS_REVIEW').length})</option>
                    <option value="CRITICAL_MISMATCH">Critical Spec Conflicts ({matches.filter(m => m.status === 'CRITICAL_MISMATCH').length})</option>
                  </select>
                </div>

                <div>
                  <select
                    value={matchingFilterCat}
                    onChange={(e) => {
                      setMatchingFilterCat(e.target.value);
                      setMatchingPage(1);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg p-2 font-semibold text-slate-700 focus:outline-hidden"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat === 'ALL' ? 'All Categories' : cat}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Matches list */}
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
                <span>Showing {filteredMatches.length} Candidate Pairs</span>
                <span>Page {matchingPage} of {totalMatchingPages}</span>
              </div>

              {filteredMatches.length === 0 ? (
                <div className="bg-white p-12 text-center border border-slate-200 rounded-xl">
                  <p className="text-sm text-slate-500">No matching candidates found for current filter criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {paginatedMatches.map((match) => {
                    const isMismatched = match.status === 'CRITICAL_MISMATCH';
                    const isStrong = match.status === 'STRONG_MATCH';
                    
                    return (
                      <div 
                        key={match.id} 
                        className={`bg-white rounded-xl border p-5 shadow-xs transition-all flex flex-col md:flex-row gap-6 items-stretch justify-between ${
                          isMismatched 
                            ? 'border-red-200 bg-red-50/5 hover:border-red-400' 
                            : isStrong 
                              ? 'border-emerald-200 hover:border-emerald-400' 
                              : 'border-amber-200 hover:border-amber-400'
                        }`}
                      >
                        {/* Side by side codes */}
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Code 1 */}
                          <div className="p-4 rounded-lg bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="bg-blue-900 text-white font-extrabold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                                  {match.material1.PSU_Name}
                                </span>
                                <span className="text-xs font-bold text-slate-400 tracking-wide">
                                  {match.material1.Material_Code}
                                </span>
                              </div>
                              <h5 className="text-xs font-extrabold text-slate-800 leading-tight">{match.material1.Description}</h5>
                              <p className="text-[11px] text-slate-500 italic truncate" title={match.material1.Specification}>
                                {match.material1.Specification}
                              </p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-slate-100 flex gap-2 text-[10px] text-slate-400">
                              <span>Size: {match.attributes1.size || "Unknown"}</span>
                              <span>•</span>
                              <span>Class: {match.attributes1.pressureClass || "Unknown"}</span>
                            </div>
                          </div>

                          {/* Code 2 */}
                          <div className="p-4 rounded-lg bg-slate-50/70 border border-slate-200 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="bg-teal-700 text-white font-extrabold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                                  {match.material2.PSU_Name}
                                </span>
                                <span className="text-xs font-bold text-slate-400 tracking-wide">
                                  {match.material2.Material_Code}
                                </span>
                              </div>
                              <h5 className="text-xs font-extrabold text-slate-800 leading-tight">{match.material2.Description}</h5>
                              <p className="text-[11px] text-slate-500 italic truncate" title={match.material2.Specification}>
                                {match.material2.Specification}
                              </p>
                            </div>
                            <div className="mt-3 pt-2 border-t border-slate-100 flex gap-2 text-[10px] text-slate-400">
                              <span>Size: {match.attributes2.size || "Unknown"}</span>
                              <span>•</span>
                              <span>Class: {match.attributes2.pressureClass || "Unknown"}</span>
                            </div>
                          </div>

                        </div>

                        {/* AI Scoring Output */}
                        <div className="md:w-64 flex flex-col justify-between shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 text-xs">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">Harmonization Score</span>
                              <span className={`font-black text-sm ${
                                isMismatched ? 'text-red-600' : isStrong ? 'text-emerald-600' : 'text-amber-600'
                              }`}>{match.confidence}%</span>
                            </div>

                            {/* Badge */}
                            <div className="flex">
                              {isMismatched ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-red-100 text-red-900">
                                  <XCircle className="w-3.5 h-3.5" /> CRITICAL MISMATCH
                                </span>
                              ) : isStrong ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-900">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> STRONG MATCH
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900">
                                  <AlertTriangle className="w-3.5 h-3.5 animate-pulse" /> NEEDS REVIEW
                                </span>
                              )}
                            </div>

                            {/* Attribute indicators */}
                            <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 font-bold mt-2">
                              <div className={`p-1 rounded text-center ${match.sizeMatch ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100'}`}>Size</div>
                              <div className={`p-1 rounded text-center ${match.materialTypeMatch ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100'}`}>Type</div>
                              <div className={`p-1 rounded text-center ${match.specMatch ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100'}`}>Rating</div>
                            </div>

                            <p className="text-[10px] text-slate-500 italic leading-tight mt-2">
                              {match.reason}
                            </p>
                          </div>

                          {/* CTA */}
                          <button
                            onClick={() => {
                              setSelectedMatch(match);
                              setActiveTab('review');
                            }}
                            className="mt-4 w-full bg-slate-900 text-white font-extrabold hover:bg-blue-900 py-1.5 px-3 text-[10px] rounded-lg shadow-sm tracking-wide uppercase transition-all cursor-pointer"
                          >
                            Execute Human Review
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* Matching Pagination Bar */}
              {totalMatchingPages > 1 && (
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 mt-4 text-xs">
                  <button
                    onClick={() => setMatchingPage(p => Math.max(1, p - 1))}
                    disabled={matchingPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-slate-500 font-semibold">
                    Page {matchingPage} of {totalMatchingPages} ({filteredMatches.length} pairs)
                  </span>
                  <button
                    onClick={() => setMatchingPage(p => Math.min(totalMatchingPages, p + 1))}
                    disabled={matchingPage === totalMatchingPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ----------------- 4. HUMAN DECISION CENTER VIEW ----------------- */}
        {activeTab === 'review' && (
          <div className="space-y-6">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-800 mb-2">Government Harmonization Board</h3>
              <p className="text-xs text-slate-500">
                Liaison officers and Ministry evaluators compare extracted specs side-by-side to authorize standard Common National Material Codes.
              </p>
            </div>

            {/* Review Action Toasts */}
            {reviewActionMsg && (
              <div className={`p-4 rounded-xl border text-sm flex items-center gap-3 ${
                reviewActionMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {reviewActionMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-rose-500" />}
                <span className="font-semibold">{reviewActionMsg.text}</span>
              </div>
            )}

            {!selectedMatch ? (
              <div className="bg-white p-12 text-center border border-slate-200 rounded-xl space-y-4">
                <p className="text-sm text-slate-500">No match candidate currently selected for side-by-side comparison.</p>
                <button
                  onClick={() => setActiveTab('matching')}
                  className="bg-blue-900 text-white text-xs px-4 py-2 rounded-lg font-bold hover:bg-blue-800"
                >
                  Select Candidate from Matches Tab
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Columns: Side-by-side spec sheet */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-teal-400" /> Standardized Dual Comparison Sheet
                    </span>
                    <span className="bg-blue-800 text-[10px] font-bold px-3 py-1 rounded">
                      Match Rating: {selectedMatch.confidence}%
                    </span>
                  </div>

                  {/* Attributes comparison grid */}
                  <div className="p-6 space-y-6">
                    
                    {/* Header Details */}
                    <div className="grid grid-cols-2 gap-6 pb-6 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="bg-blue-900 text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                            {selectedMatch.material1.PSU_Name}
                          </span>
                          <span className="text-xs font-bold text-slate-400">{selectedMatch.material1.Material_Code}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 leading-tight">{selectedMatch.material1.Description}</h4>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="bg-teal-700 text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase">
                            {selectedMatch.material2.PSU_Name}
                          </span>
                          <span className="text-xs font-bold text-slate-400">{selectedMatch.material2.Material_Code}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 leading-tight">{selectedMatch.material2.Description}</h4>
                      </div>
                    </div>

                    {/* Extracted Attributes Rows (Step 13) */}
                    <div className="space-y-3.5">
                      <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                        AI Attribute Extractions — Category: {selectedMatch.material1.Category || "Uncategorized"}
                      </h5>
                      
                      {selectedMatch.comparisonRows && selectedMatch.comparisonRows.length > 0 ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-4 px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <div>Attribute</div>
                            <div>{selectedMatch.material1.PSU_Name}</div>
                            <div>{selectedMatch.material2.PSU_Name}</div>
                          </div>
                          {selectedMatch.comparisonRows.map((row, idx) => {
                            const isMatch = row.status === 'MATCH';
                            const isCritMismatch = row.status === 'CRITICAL_MISMATCH';
                            return (
                              <div key={idx} className={`grid grid-cols-3 gap-4 items-center p-3 rounded-lg border text-xs transition-all ${
                                isCritMismatch 
                                  ? 'bg-red-50/50 border-red-100 text-red-950 font-bold' 
                                  : isMatch 
                                    ? 'bg-emerald-50/30 border-emerald-100' 
                                    : 'bg-slate-50/50 border-slate-200/60'
                              }`}>
                                <div className="font-bold text-slate-700 flex items-center gap-1.5">
                                  {row.attribute}
                                  {isCritMismatch && <span className="text-[9px] px-1 py-0.2 bg-red-100 text-red-800 rounded">Critical</span>}
                                </div>
                                <div className="font-semibold text-slate-800 break-all">
                                  {row.val1}
                                </div>
                                <div className="font-semibold text-slate-800 flex items-center gap-1.5 break-all">
                                  {row.val2}
                                  {isMatch && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                  {isCritMismatch && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 animate-pulse" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-400 italic">No attributes extracted for this category.</div>
                      )}

                      <div className="grid grid-cols-3 gap-4 items-center bg-slate-50/60 p-3 rounded-lg border border-slate-150 text-xs mt-4">
                        <div className="font-bold text-slate-700">HSN Code Match</div>
                        <div className="font-semibold text-slate-800">
                          {selectedMatch.material1.HSN_Code || "N/A"}
                        </div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {selectedMatch.material2.HSN_Code || "N/A"}
                          {selectedMatch.material1.HSN_Code === selectedMatch.material2.HSN_Code && selectedMatch.material1.HSN_Code && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Raw Text comparison block */}
                    <div className="space-y-3">
                      <h5 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Raw Material Specifications</h5>
                      <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-lg border border-slate-150">
                        <div>
                          <span className="font-semibold text-slate-700">Spec Detail:</span>
                          <p className="mt-1">{selectedMatch.material1.Specification || "No specifications listed."}</p>
                          <span className="mt-2 block text-[10px] font-bold text-slate-400">UOM: {selectedMatch.material1.Unit_of_Measure}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-700">Spec Detail:</span>
                          <p className="mt-1">{selectedMatch.material2.Specification || "No specifications listed."}</p>
                          <span className="mt-2 block text-[10px] font-bold text-slate-400">UOM: {selectedMatch.material2.Unit_of_Measure}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Right Columns: Decisions & Approvals form */}
                <div className="space-y-4">
                  
                  {/* Matching decision card */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
                    <h4 className="font-extrabold text-sm text-slate-800">Harmonization Decision Panel</h4>
                    
                    {/* Status warning badge */}
                    {selectedMatch.status === 'CRITICAL_MISMATCH' ? (
                      <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-900 text-xs space-y-1">
                        <span className="font-extrabold flex items-center gap-1 text-rose-700 uppercase tracking-tight">
                          <XCircle className="w-4 h-4 shrink-0" /> Match Status: NOT RECOMMENDED
                        </span>
                        <p className="leading-tight text-slate-600">
                          <span className="font-semibold text-rose-800">Reason:</span> {selectedMatch.reason}
                        </p>
                      </div>
                    ) : selectedMatch.status === 'STRONG_MATCH' ? (
                      <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-900 text-xs space-y-1">
                        <span className="font-extrabold flex items-center gap-1 text-emerald-700 uppercase tracking-tight">
                          <CheckCircle2 className="w-4 h-4 shrink-0" /> Match Status: HIGH CONFIDENCE
                        </span>
                        <p className="leading-tight text-slate-600">
                          AI engine reports a high equivalence probability. Material is recommended for Common National Code mapping.
                        </p>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900 text-xs space-y-1">
                        <span className="font-extrabold flex items-center gap-1 text-amber-700 uppercase tracking-tight">
                          <AlertTriangle className="w-4 h-4 shrink-0" /> Match Status: INSUFFICIENT DATA
                        </span>
                        <p className="leading-tight text-slate-600">
                          Review physical specification and dimensional tolerances. Liaison approval required.
                        </p>
                      </div>
                    )}

                    {/* Transparent AI Explanation (Step 9) */}
                    {selectedMatch.explanationList && selectedMatch.explanationList.length > 0 && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">AI Decision Checklist & Logic</span>
                        <div className="space-y-1">
                          {selectedMatch.explanationList.map((exp, idx) => {
                            const isCrit = exp.startsWith('✗');
                            const isWarn = exp.startsWith('!');
                            return (
                              <div key={idx} className={`text-[11px] font-semibold flex items-start gap-1.5 ${
                                isCrit ? 'text-rose-700' : isWarn ? 'text-amber-700' : 'text-slate-600'
                              }`}>
                                <span className="shrink-0">{exp.slice(0, 1)}</span>
                                <span>{exp.slice(1).trim()}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Role Warning / Security check */}
                    {role === 'cpse' && (
                      <div className="p-3 bg-teal-50 text-teal-900 text-[11px] rounded-lg border border-teal-200">
                        <span className="font-bold block text-teal-800">CPSE Read-Only Liaison Mode</span>
                        You are viewing this pair as the <strong>{selectedCpse} Liaison Representative</strong>. Approvals or rejections are only officially validated when executed by Ministry/Admin authorities.
                      </div>
                    )}

                    {/* Decision options */}
                    <div className="space-y-3.5 pt-2">
                      <button
                        onClick={() => handleReviewDecision('APPROVE')}
                        className={`w-full py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all ${
                          role === 'cpse' 
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                            : 'bg-emerald-700 text-white hover:bg-emerald-800'
                        }`}
                        disabled={role === 'cpse'}
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve & Link to Common Code
                      </button>

                      <button
                        onClick={() => handleReviewDecision('NEEDS_INFO')}
                        className={`w-full py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all border ${
                          role === 'cpse' 
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed border-transparent' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                        disabled={role === 'cpse'}
                      >
                        <HelpCircle className="w-4 h-4 text-slate-500" /> Hold - Request Clarifications
                      </button>

                      {/* Rejection blocks */}
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Rejection Reason Code</label>
                        <select
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg p-2 font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                        >
                          <option value="Different Pressure Rating">Different Pressure Rating</option>
                          <option value="Different Material Grade">Different Material Grade</option>
                          <option value="Different Specification">Different Specification</option>
                          <option value="Not Interchangeable">Not Interchangeable</option>
                          <option value="Other">Other Reason...</option>
                        </select>

                        {rejectReason === 'Other' && (
                          <input
                            type="text"
                            value={customRejectReason}
                            onChange={(e) => setCustomRejectReason(e.target.value)}
                            placeholder="Type custom rejection explanation..."
                            className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg p-2 font-semibold text-slate-700"
                          />
                        )}

                        <button
                          onClick={() => handleReviewDecision('REJECT')}
                          className={`w-full py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all ${
                            role === 'cpse' 
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                              : 'bg-rose-700 text-white hover:bg-rose-800'
                          }`}
                          disabled={role === 'cpse'}
                        >
                          <XCircle className="w-4 h-4" /> Reject Equivalence Mapping
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Active Match Candidates Selector */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                        Awaiting Decisions ({matches.filter(m => m.status === 'NEEDS_REVIEW').length})
                      </h5>
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {matches.slice(0, 30).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedMatch(item);
                            setReviewActionMsg(null);
                          }}
                          className={`w-full text-left p-2.5 rounded-lg border text-xs flex justify-between items-center transition-all cursor-pointer ${
                            selectedMatch.id === item.id 
                              ? 'bg-blue-50/70 border-blue-400 font-bold text-blue-950 shadow-xs' 
                              : 'border-slate-150 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <div className="truncate shrink-1 pr-2">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">{item.material1.PSU_Name} &harr; {item.material2.PSU_Name}</span>
                            <span className="truncate block">{item.material1.Description}</span>
                          </div>
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                            item.status === 'CRITICAL_MISMATCH' 
                              ? 'bg-red-100 text-red-900' 
                              : item.status === 'STRONG_MATCH' 
                                ? 'bg-emerald-100 text-emerald-900' 
                                : 'bg-amber-100 text-amber-900'
                          }`}>{item.confidence}%</span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>
        )}

        {/* ----------------- 5. COMMON MATERIAL MAPPING REGISTER ----------------- */}
        {activeTab === 'mappings' && (
          <div className="space-y-6">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Centralized National Material Registry (NMC)</h3>
                <p className="text-xs text-slate-500">
                  Official assigned Common Codes. This establishes a universal standard reference while leaving each CPSE's local operational codes perfectly preserved.
                </p>
              </div>
              <div className="w-full md:w-72 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={mappingsSearchQuery}
                  onChange={(e) => {
                    setMappingsSearchQuery(e.target.value);
                    setMappingsPage(1);
                  }}
                  placeholder="Search code, PSU, or description..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-hidden font-medium"
                />
              </div>
            </div>

            {/* Registry table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider flex justify-between items-center">
                <span>Common National Material Mappings ({filteredMappings.length})</span>
                <span className="text-[10px] text-slate-400 font-semibold normal-case">Page {mappingsPage} of {totalMappingsPages}</span>
              </div>

              {filteredMappings.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No Common National Material Codes found matching search criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 font-extrabold uppercase border-b border-slate-200">
                        <th className="p-4">Common Code</th>
                        <th className="p-4">Standardized Name / Description</th>
                        <th className="p-4">Material Category</th>
                        <th className="p-4">Linked CPSE Local Material Codes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {paginatedMappings.map((item) => (
                        <tr key={item.commonCode} className="hover:bg-slate-50">
                          <td className="p-4 shrink-0 font-black text-blue-900 tracking-wider">
                            {item.commonCode}
                          </td>
                          <td className="p-4 font-bold text-slate-800">
                            {item.standardDescription}
                          </td>
                          <td className="p-4 shrink-0">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-600">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1.5">
                              {item.linkedMaterials.map((lm, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-blue-100 text-blue-900 shrink-0">
                                    {lm.PSU_Name}
                                  </span>
                                  <span className="text-slate-400 font-bold">{lm.Material_Code}</span>
                                  <span className="text-slate-600 font-semibold text-[11px] truncate max-w-sm" title={lm.Description}>
                                    &ndash; {lm.Description}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mappings Pagination */}
              {totalMappingsPages > 1 && (
                <div className="flex justify-between items-center bg-white p-3 border-t border-slate-100 text-xs">
                  <button
                    onClick={() => setMappingsPage(p => Math.max(1, p - 1))}
                    disabled={mappingsPage === 1}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-slate-500 font-semibold text-[11px]">
                    Page {mappingsPage} of {totalMappingsPages} ({filteredMappings.length} mappings)
                  </span>
                  <button
                    onClick={() => setMappingsPage(p => Math.min(totalMappingsPages, p + 1))}
                    disabled={mappingsPage === totalMappingsPages}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ----------------- 6. DATASET & CSV UPLOAD VIEW ----------------- */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Dataset Expansion & Sandbox Testing</h3>
                <p className="text-xs text-slate-500">
                  Currently loaded: <span className="font-extrabold text-blue-900">{materials.length} records</span> across 6 simulated organizations. You can upload custom CSV text files below to append materials dynamically.
                </p>
              </div>
              <button
                onClick={loadSampleUploadData}
                className="bg-blue-900 text-white font-extrabold hover:bg-blue-800 text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 tracking-wide shadow-xs shrink-0 cursor-pointer"
              >
                <FileText className="w-4 h-4" /> Load Sample Test CSV
              </button>
            </div>

            {/* Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* CSV Upload form */}
              <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="font-bold text-sm text-slate-800">Paste Material CSV Code Block</h4>
                
                {uploadStatus && (
                  <div className={`p-4 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                    uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                  }`}>
                    {uploadStatus.type === 'success' ? <CheckCircle2 className="w-4.5 h-4.5" /> : <XCircle className="w-4.5 h-4.5" />}
                    <span>{uploadStatus.msg}</span>
                  </div>
                )}

                <form onSubmit={handleCsvUpload} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                      CSV Data (including headers)
                    </label>
                    <textarea
                      value={rawCsvText}
                      onChange={(e) => setRawCsvText(e.target.value)}
                      placeholder="PSU_Name,Material_Code,Description,Specification,Unit_of_Measure,Category,HSN_Code&#10;ONGC,ONGC-PIPE-999,CS Pipe DN100,Size 100mm Carbon Steel,MTRS,PIPES,73041910"
                      className="w-full h-64 bg-slate-50 border border-slate-200 text-xs rounded-lg p-3 font-mono focus:outline-hidden focus:ring-1 focus:ring-blue-900 focus:bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploading || !rawCsvText.trim()}
                    className={`w-full py-2.5 px-4 rounded-lg font-extrabold text-xs flex items-center justify-center gap-2 text-white shadow-xs transition-all cursor-pointer ${
                      uploading || !rawCsvText.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800'
                    }`}
                  >
                    <UploadCloud className="w-4 h-4" /> 
                    {uploading ? 'Processing matching vectors...' : 'Load & Recompute AI Matches'}
                  </button>
                </form>
              </div>

              {/* Instructions and Rules */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="font-bold text-sm text-slate-800">File & Parsing Requirements</h4>
                
                <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
                  <p>
                    CSV rows are checked dynamically before ingestion. Row items missing <strong>PSU_Name</strong>, <strong>Material_Code</strong>, or <strong>Description</strong> are skipped automatically to protect database integrity.
                  </p>
                  
                  <div>
                    <span className="font-bold text-slate-700 block">Required CSV Columns:</span>
                    <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded font-bold">PSU_Name, Material_Code, Description, Specification, Unit_of_Measure, Category, HSN_Code</code>
                  </div>

                  <div>
                    <span className="font-bold text-slate-700 block">Standard Category Codes:</span>
                    <div className="grid grid-cols-2 gap-1 mt-1 text-[10px] font-semibold text-slate-500">
                      <span>PIPES</span>
                      <span>VALVES</span>
                      <span>ELECTRICAL</span>
                      <span>FITTINGS</span>
                      <span>PUMPS</span>
                      <span>FLANGES</span>
                      <span>GASKETS</span>
                      <span>INSTRUMENTATION</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px]">
                    <span className="font-extrabold text-slate-800 block mb-1">Robustness Check</span>
                    Real CSV logs visible in your browser or dev console log skipping details and error states instantly.
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ----------------- 7. SHARED INVENTORY DEMO VIEW ----------------- */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-800 mb-1">Optional Inter-CPSE Surplus Inventory Sharing</h3>
              <p className="text-xs text-slate-500">
                <span className="font-extrabold text-emerald-800">Demo Mode Only:</span> Inventory sharing is optional. CPSEs control whether availability or warehouse information is shared.
              </p>
            </div>

            {/* Static inventory mock data */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider">
                Cross-CPSE Spare Parts & Emergency Inventory Reserves
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 font-extrabold uppercase border-b border-slate-200">
                      <th className="p-4">Common Code</th>
                      <th className="p-4">Standardized Material Description</th>
                      <th className="p-4">Holding PSU</th>
                      <th className="p-4 text-center">Available Stock</th>
                      <th className="p-4">Warehouse Facility</th>
                      <th className="p-4">Emergency Contact</th>
                      <th className="p-4">Sharing Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {[
                      { code: "NMC-VALVE-000245", desc: "Gate Valve 6 Inch Carbon Steel Class 150", psu: "ONGC", stock: "14 NOS", facility: "Hazira Offshore Base, Gujarat", contact: "hazira.materials@ongc.co.in", status: "Active Sharing" },
                      { code: "NMC-VALVE-000245", desc: "Gate Valve 6 Inch Carbon Steel Class 150", psu: "IOCL", stock: "4 NOS", facility: "Panipat Refinery Stores, Haryana", contact: "panipat.stores@iocl.in", status: "Active Sharing" },
                      { code: "NMC-PIPE-000001", desc: "MS Seamless Pipe 100mm NB Sch 40", psu: "NTPC", stock: "280 MTRS", facility: "Ramagundam Power Station, Telangana", contact: "ramagundam.stores@ntpc.co.in", status: "Active Sharing" },
                      { code: "NMC-PIPE-000001", desc: "MS Seamless Pipe 100mm NB Sch 40", psu: "ONGC", stock: "150 MTRS", facility: "Uran Terminal Stores, Maharashtra", contact: "uran.mats@ongc.co.in", status: "Active Sharing" },
                      { code: "NMC-ELEC-000055", desc: "Copper Armored Cable 3C x 16 Sqmm", psu: "BHEL", stock: "1,200 MTRS", facility: "Haridwar Heavy Equipment Plant, UK", contact: "haridwar.supply@bhel.in", status: "Active Sharing" },
                      { code: "NMC-FLG-000301", desc: "Weld Neck Flange 4 Inch Class 150 RF", psu: "BPCL", stock: "45 NOS", facility: "Kochi Refinery Base, Kerala", contact: "kochi.procure@bpcl.in", status: "Active Sharing" }
                    ].map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-4 font-black text-blue-950 tracking-wider shrink-0">{item.code}</td>
                        <td className="p-4 font-bold text-slate-800">{item.desc}</td>
                        <td className="p-4 shrink-0">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-extrabold text-slate-700">{item.psu}</span>
                        </td>
                        <td className="p-4 text-center font-bold text-emerald-800 shrink-0">{item.stock}</td>
                        <td className="p-4 text-slate-600">{item.facility}</td>
                        <td className="p-4 text-blue-900 font-bold">{item.contact}</td>
                        <td className="p-4 shrink-0">
                          <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded text-[9px] font-bold">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ----------------- 8. SYSTEM AUDIT LOGS VIEW ----------------- */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Decisions & Operations Log Sheet</h3>
                <p className="text-xs text-slate-500">
                  Chronological ledger tracking Ministry evaluations, approvals, code generation events, and custom data loading activities during this session.
                </p>
              </div>
              <div className="w-full md:w-72 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={auditSearchQuery}
                  onChange={(e) => {
                    setAuditSearchQuery(e.target.value);
                    setAuditPage(1);
                  }}
                  placeholder="Search user, action, code, or decision..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-lg focus:outline-hidden font-medium"
                />
              </div>
            </div>

            {/* Audit log table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider flex justify-between items-center">
                <span>Regulatory Action Trail ({filteredAuditLogs.length})</span>
                <span className="text-[10px] text-slate-400 font-semibold normal-case">Page {auditPage} of {totalAuditPages}</span>
              </div>

              {filteredAuditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No administrative actions found matching search criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 font-extrabold uppercase border-b border-slate-200">
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Evaluator</th>
                        <th className="p-4">Action Event</th>
                        <th className="p-4">Target Codes</th>
                        <th className="p-4">Descriptions Evaluated</th>
                        <th className="p-4">Decision Outcome</th>
                        <th className="p-4">Reason Details / Criteria</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {paginatedAuditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="p-4 shrink-0 text-slate-400 font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {log.timestamp}
                          </td>
                          <td className="p-4 font-semibold text-slate-600 shrink-0">{log.user}</td>
                          <td className="p-4 shrink-0">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold ${
                              log.action === 'APPROVE' 
                                ? 'bg-emerald-100 text-emerald-900' 
                                : log.action === 'REJECT' 
                                  ? 'bg-rose-100 text-rose-900' 
                                  : 'bg-amber-100 text-amber-900'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 font-bold shrink-0">
                            {log.material1Code} &harr; {log.material2Code}
                          </td>
                          <td className="p-4 text-slate-700 max-w-sm">
                            <div className="truncate leading-tight font-bold">{log.material1Desc}</div>
                            <div className="truncate leading-tight text-[11px] text-slate-400 mt-0.5">{log.material2Desc}</div>
                          </td>
                          <td className="p-4 font-extrabold text-blue-900 shrink-0">
                            {log.finalDecision}
                          </td>
                          <td className="p-4 text-slate-500 max-w-xs truncate" title={log.reason}>
                            {log.reason || "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Audit Pagination */}
              {totalAuditPages > 1 && (
                <div className="flex justify-between items-center bg-white p-3 border-t border-slate-100 text-xs">
                  <button
                    onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                    disabled={auditPage === 1}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-slate-500 font-semibold text-[11px]">
                    Page {auditPage} of {totalAuditPages} ({filteredAuditLogs.length} actions)
                  </span>
                  <button
                    onClick={() => setAuditPage(p => Math.min(totalAuditPages, p + 1))}
                    disabled={auditPage === totalAuditPages}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        </div>

        {/* ----------------- STREAMLINED FOOTER ----------------- */}
        <footer className="bg-white border-t border-slate-200 py-4 px-8 text-center text-[11px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 z-10">
          <p className="font-semibold">&copy; 2026 MaterialSync AI. Standardized Material Mapping Layer.</p>
          <div className="flex gap-4 font-bold text-slate-500">
            <span>Port: 3000 (Active Proxy)</span>
            <span>Store: JSON Data Layer</span>
            <span>Engine: TF-IDF Vector Space</span>
          </div>
        </footer>

      </main>

    </div>
  );
}
